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

import { Deflate, Inflate } from "./fflate-shim";
import { Uint8ArrayReader, ZipWriter, configure } from "@zip.js/zip.js";

configure({ Deflate, Inflate });

export type ZipFile = { path: string; data: Uint8Array };

export function createZipStream() {
  const written = new Set<string>();
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const writer = new ZipWriter<Uint8Array>(ts.writable);
  const entryWriter = new WritableStream<ZipFile>({
    start() {},
    async write(chunk, c) {
      // zip.js doesn't support overwriting files.
      if (written.has(chunk.path)) return;

      await writer
        .add(chunk.path, new Uint8ArrayReader(chunk.data))
        .catch(async (e) => {
          await ts.writable.abort(e);
          await ts.readable.cancel(e);
          c.error(e);
        });
      written.add(chunk.path);
    },
    async close() {
      await writer.close(undefined, { zip64: true });
      await ts.writable.close();
    },
    async abort(reason) {
      await ts.writable.abort(reason);
      await ts.readable.cancel(reason);
    }
  });
  return { writable: entryWriter, readable: ts.readable };
}
