import React from "react";
import { readFile, readdir } from "node:fs/promises";
import sanitizeFilename from "https://esm.sh/sanitize-filename@1.6.3";
import ReactMarkdown from "https://esm.sh/react-markdown@8.0.7";
import { throwNotFound, readDirectory } from "./utils/utils.ts";
import { addComment, getCommentsBySlug } from "./db2.ts";

export default function Router({ url }) {
  let page;
  if (url.pathname === "/") {
    console.log("in rsc server Router; url.pathname is /");
    page = <BlogIndexPage />;
  } else {
    console.log("in rsc server Router; url.pathname is not /");

    const postSlug = sanitizeFilename(url.pathname.slice(1));
    page = <BlogPostPage postSlug={postSlug} />;
  }
  return (
    <BlogLayout>
      {<React.Fragment key={url.pathname}>{page}</React.Fragment>}
    </BlogLayout>
  );
}

async function BlogIndexPage() {
  async function getPostSlugs() {
    const directoryPath = "./posts";
    const postFiles = await readDirectory(directoryPath);
    const postSlugs = postFiles.map((file) =>
      file.slice(0, file.lastIndexOf("."))
    );
    return postSlugs;
  }
  const postSlugs = await getPostSlugs();
  return (
    <section>
      <h1>Welcome to my blog</h1>
      <div>
        {postSlugs.map((slug) => (
          <Post key={slug} slug={slug} />
        ))}
      </div>
    </section>
  );
}

function BlogPostPage({ postSlug }) {
  return (
    <>
      <Post slug={postSlug} />
      <CommentForm slug={postSlug} />
      <Comments slug={postSlug} />
    </>
  );
}

async function Post({ slug }) {
  let content;
  try {
    content = await readFile("./posts/" + slug + ".txt", "utf8");
  } catch (err) {
    throwNotFound(err);
  }
  return (
    <section>
      <h2>
        <a href={"/" + slug}>{slug}</a>
      </h2>
      <article>
        <ReactMarkdown
          children={content}
          components={{
            img: ({ node, ...props }) => (
              <img style={{ maxWidth: "100%" }} {...props} />
            ),
          }}
        />
      </article>
    </section>
  );
}

async function CommentForm({ slug }) {
  return (
    <form id={`${slug}-form`} action={`/${slug}`} method="post">
      <input hidden readOnly name="slug" value={slug} />
      <textarea name="comment" required></textarea>
      <button type="submit">Post Comment</button>
    </form>
  );
}

async function Comments({ slug }) {
  let comments;
  try {
    comments = await getCommentsBySlug({ slug });
    console.log("in RSC Comments; comments: ", comments, "slug: ", slug);
  } catch (err) {
    console.log("No comments found for post:", slug);
    throwNotFound(err);
  }
  return (
    <section>
      <h2>Comments</h2>
      <ul>
        {comments?.map((comment) => (
          <li key={comment.slug}>
            <p>{comment.comment}</p>
            <p>
              <i>by {comment.author}</i>
            </p>
            <p>at {Date(comment.timestamp)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlogLayout({ children }) {
  const author = "Jae Doe";
  return (
    <html>
      <head>
        <title>My blog</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <hr />
          <input />
          <hr />
        </nav>
        <main>{children}</main>
        <Footer author={author} />
      </body>
    </html>
  );
}

function Footer({ author }) {
  return (
    <>
      <footer>
        <hr />
        <p>
          <i>
            (c) {author} {new Date().getFullYear()}
          </i>
        </p>
      </footer>
    </>
  );
}
