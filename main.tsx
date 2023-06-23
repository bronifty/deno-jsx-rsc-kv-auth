import React from "https://esm.sh/react@18.2.0";
import * as ReactDOMServer from "https://esm.sh/react-dom@18.2.0/server";
import { readFile, readdir } from "node:fs/promises";
import ReactMarkdown from "https://esm.sh/react-markdown@8.0.7";
// import readDirectory from "./utils/readdir.js";
import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { addComment, getCommentsBySlug } from "./db2.ts";
import Router from "./components.tsx";
import { parseMultipartFormData, readDirectory } from "./utils/utils.ts";

async function handler(req) {
  const url = new URL(req.url);
  const slug = url.pathname;
  if (req.method === "POST") {
    console.log("req.method === 'POST'", url);
    let body = await req.text();
    let contentType = req.headers.get("content-type");
    let boundary = contentType.split("; ")[1].split("=")[1];
    // parse the form data
    let parsedBody = parseMultipartFormData(body, boundary);
    let slug = parsedBody.slug;
    let comment = parsedBody.comment;
    try {
      await addComment({ slug, comment });
      return new Response("ok");
    } catch (error) {
      return new Response("error");
    }
  }
  if (slug === "/client.ts") {
    const content = await sendScript({ request: req, filename: "./client.ts" });
    return new Response(content, {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  }
  try {
    if (url.searchParams.has("jsx")) {
      url.searchParams.delete("jsx");
      // RSC (lives in window.__INITIAL_CLIENT_JSX_STRING__)
      const clientJSXString = await sendJSX(<Router url={url} />);
      return new Response(clientJSXString, {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    } else {
      // SSR (1st load)
      const html = await sendHTML(<Router url={url} />);
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  } catch (err) {
    console.error(err);
    return new Response(err.stack, { status: 500 });
  }
}
serve(handler, { port: 8080 });

async function sendScript({ request, filename }) {
  const content = await readFile(filename, "utf8");
  return content;
  // return await fetch(filename, {
  //   headers: request.headers,
  //   method: request.method,
  //   body: request.body,
  // });
}

async function sendJSX(jsx) {
  const clientJSX = await renderJSXToClientJSX(jsx);
  const clientJSXString = JSON.stringify(clientJSX, stringifyJSX);
  return clientJSXString;
}

async function sendHTML(jsx) {
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

async function renderJSXToClientJSX(jsx) {
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

function stringifyJSX(key, value) {
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