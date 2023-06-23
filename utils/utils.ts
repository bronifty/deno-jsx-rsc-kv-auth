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
