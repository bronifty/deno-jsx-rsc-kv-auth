import React from "react";
// import React from "https://esm.sh/react@18.2.0";
// import * as ReactDOMServer from "https://esm.sh/react-dom@18.2.0/server";
import ReactMarkdown from "https://esm.sh/react-markdown@8.0.7";
import { serve } from "serve";
import { addComment, getCommentsBySlug } from "./db2.ts";
import Router from "./components.tsx";
import {
  parseMultipartFormData,
  readDirectory,
  sendScript,
  sendJSX,
  sendHTML,
  renderJSXToClientJSX,
  stringifyJSX,
} from "./utils/utils.ts";

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
