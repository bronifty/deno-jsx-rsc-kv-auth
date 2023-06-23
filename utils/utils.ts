import React from "https://esm.sh/react@18.2.0";
import * as ReactDOMServer from "https://esm.sh/react-dom@18.2.0/server";
import { readFile, readdir } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

export async function readDirectory(directoryPath) {
  try {
    // Read the contents of the directory
    const files = await fs.promises.readdir(directoryPath);

    // Filter out subdirectories and return only files
    const filesOnly = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directoryPath, file);
        const stat = await fs.promises.lstat(filePath);
        if (stat.isFile()) {
          return file;
        }
        return null;
      })
    );

    return filesOnly.filter(Boolean);
  } catch (error) {
    console.error("Error reading directory:", error);
    return [];
  }
}

export function parseMultipartFormData(body, boundary) {
  let result = {};
  // Split the body string into individual parts
  let parts = body.split("--" + boundary).slice(1, -1);

  parts.forEach((part) => {
    // Split each part into lines
    let lines = part.split("\r\n").filter((line) => line);
    // The first line should contain the "Content-Disposition" header
    let contentDisposition = lines[0];
    // The field name is inside quotes after 'name='
    let fieldName = contentDisposition.split(";")[1].split("=")[1];
    fieldName = fieldName.replace(/"/g, "").trim(); // Remove the quotes around the field name
    // The field value is on the last line
    let fieldValue = lines[lines.length - 1].trim();
    // Add this field to the result
    result[fieldName] = fieldValue;
  });

  return result;
}

export function throwNotFound(cause) {
  const notFound = new Error("Not found.", { cause });
  notFound.statusCode = 404;
  throw notFound;
}

export async function sendScript({ request, filename }) {
  const content = await readFile(filename, "utf8");
  return content;
}

export async function sendJSX(jsx) {
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX);
  return clientJSXString;
}

export async function sendHTML(jsx) {
  const clientJSX = await renderJSXToClientJSX(jsx);
  let html = await ReactDOMServer.renderToString(clientJSX);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX);
  html += `<script>window.__INITIAL_CLIENT_JSX_STRING__ = `;
  html += JSON.stringify(clientJSXString).replace(/</g, "\\u003c"); // Escape the string
  html += `</script>`;
  html += `
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@canary",
          "react-dom/client": "https://esm.sh/react-dom@canary/client"
        }
      }
    </script>
    <script type="module" src="/client.ts"></script>
  `;
  return html;
}

export async function renderJSXToClientJSX(jsx) {
  if (
    typeof jsx === "string" ||
    typeof jsx === "number" ||
    typeof jsx === "boolean" ||
    jsx == null
  ) {
    return jsx;
  } else if (Array.isArray(jsx)) {
    return Promise.all(jsx.map((child) => renderJSXToClientJSX(child)));
  } else if (jsx != null && typeof jsx === "object") {
    if (jsx.$$typeof === Symbol.for("react.element")) {
      if (jsx.type === Symbol.for("react.fragment")) {
        return renderJSXToClientJSX(jsx.props.children);
      } else if (typeof jsx.type === "string") {
        return {
          ...jsx,
          props: await renderJSXToClientJSX(jsx.props),
        };
      } else if (typeof jsx.type === "function") {
        const Component = jsx.type;
        const props = jsx.props;
        const returnedJsx = await Component(props); // this is where server fetching happens
        // console.log("returnedJsx", returnedJsx);
        return renderJSXToClientJSX(returnedJsx);
      } else {
        console.log("jsx fragment", jsx);
        throw new Error("Not implemented.");
      }
    } else {
      return Object.fromEntries(
        await Promise.all(
          Object.entries(jsx).map(async ([propName, value]) => [
            propName,
            await renderJSXToClientJSX(value),
          ])
        )
      );
    }
  } else {
    console.log("jsx fragment", jsx);
    throw new Error("Not implemented");
  }
}

export function stringifyJSX(key, value) {
  if (value === Symbol.for("react.element")) {
    // We can't pass a symbol, so pass our magic string instead.
    return "$RE"; // Could be arbitrary. I picked RE for React Element.
  } else if (typeof value === "string" && value.startsWith("$")) {
    // To avoid clashes, prepend an extra $ to any string already starting with $.
    return "$" + value;
  } else {
    return value;
  }
}
