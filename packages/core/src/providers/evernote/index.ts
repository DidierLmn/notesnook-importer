/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { parse, processContent } from "@notesnook-importer/enex";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error,
  log
} from "../provider";
import { ContentType, Note, Notebook } from "../../models/note";
import { ElementHandler } from "./element-handlers";
import { File } from "../../utils/file";
import { Providers } from "../provider-factory";

export class Evernote implements IFileProvider {
  id: Providers = "evernote";
  type = "file" as const;
  supportedExtensions = [".enex"];
  examples = ["First Notebook.enex", "checklist.enex"];
  version = "1.0.0";
  name = "Evernote";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-evernote";
  private ids: Record<string, string> = {};

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const notebook: Notebook = {
      title: file.nameWithoutExtension,
      children: []
    };

    for await (const chunk of parse(
      file.stream.pipeThrough(new TextDecoderStream())
    )) {
      for (const enNote of chunk) {
        yield log(`Found ${enNote.title}...`);

        const note: Note = {
          id: this.ids[enNote.title || ""],
          title: enNote.title || "",
          tags: enNote.tags,
          dateCreated: enNote.created?.getTime(),
          dateEdited: enNote.updated?.getTime(),
          attachments: [],
          notebooks: [notebook]
        };
        if (enNote.content) {
          const elementHandler = new ElementHandler(
            note,
            enNote,
            settings.hasher,
            this.ids
          );

          try {
            const html = await processContent(
              enNote.content,
              elementHandler,
              enNote
            );
            note.content = {
              data: html.trim(),
              type: ContentType.HTML
            };
          } catch (e) {
            yield error(e, { note });
          }
        }

        yield { type: "note", note };
      }
    }
  }
}
