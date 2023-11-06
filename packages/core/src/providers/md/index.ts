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

import { IFileProvider, ProviderSettings } from "../provider";
import { File } from "../../utils/file";
import { markdowntoHTML } from "../../utils/to-html";
import { HTML } from "../html";
import { parseFrontmatter } from "../../utils/frontmatter";

export class Markdown implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".md", ".markdown", ".mdown"];
  public version = "1.0.0";
  public name = "Markdown";
  public examples = ["document.md"];
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-markdown-files";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(file: File, settings: ProviderSettings, files: File[]) {
    const text = await file.text();
    const { content, frontmatter } = parseFrontmatter(text);
    const html = markdowntoHTML(content);
    const note = await HTML.processHTML(file, files, settings.hasher, html);
    if (frontmatter) {
      note.title = frontmatter.title || note.title;
      note.tags = cleanupTags(
        Array.isArray(frontmatter.tags)
          ? frontmatter.tags
          : frontmatter.tags?.split(",") || []
      );
      note.pinned = frontmatter.pinned;
      note.favorite = frontmatter.favorite;
      note.dateCreated = getPropertyWithFallbacks(
        frontmatter,
        ["created", "created_at", "date created"],
        note.dateCreated
      );
      note.dateEdited = getPropertyWithFallbacks(
        frontmatter,
        ["updated", "updated_at", "date updated"],
        note.dateEdited
      );
      note.color = frontmatter.color;
    }
    yield note;
  }
}

function getPropertyWithFallbacks<T, R>(
  obj: T,
  properties: (keyof T)[],
  fallback: R
): R {
  for (const property of properties) {
    if (obj[property]) return obj[property] as R;
  }
  return fallback;
}

function cleanupTags(tags: string[]) {
  return tags.map((tag) => tag.replace("#", "").trim());
}
