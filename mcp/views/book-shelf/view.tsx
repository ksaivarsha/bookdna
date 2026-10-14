/** A shelf of verified books in BookDNA's Victorian manuscript style. */
import { useOpenExternal, useToolContext } from "mcp-use/react";
import "./view.css";

type Book = { id: string; title: string; author: string; cover: string; reason: string; url: string };

function Ornament() {
  return (
    <div className="bs-ornament" aria-hidden="true">
      <span className="bs-rule" />
      <span className="bs-fleuron">❦</span>
      <span className="bs-rule" />
    </div>
  );
}

function Cover({ book }: { book: Book }) {
  if (book.cover) return <img className="bs-cover" src={book.cover} alt="" loading="lazy" />;
  return (
    <div className="bs-cover bs-cover--blank" aria-hidden="true">
      <span>{book.title}</span>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bs-page">
      <div className="bs-frame">{children}</div>
    </div>
  );
}

export default function BookShelf() {
  // Bound to both recommend and recommend_by_tropes, which share one output schema.
  const { status, toolOutput, error } = useToolContext<"recommend">();
  const openExternal = useOpenExternal();

  if (status === "pending") {
    return (
      <Frame>
        <h2 className="bs-heading">Consulting the Archive</h2>
        <Ornament />
        <div className="bs-shelf">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bs-card bs-card--ghost">
              <div className="bs-cover bs-cover--blank" />
              <div className="bs-ghost-line" />
              <div className="bs-ghost-line bs-ghost-line--short" />
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  if (status === "error") {
    return (
      <Frame>
        <h2 className="bs-heading">A Blot upon the Page</h2>
        <Ornament />
        <p className="bs-notice">{error?.message ?? "The shelf could not be assembled."}</p>
      </Frame>
    );
  }

  const { heading, subheading, books, notice, source } = toolOutput;

  return (
    <Frame>
      <h2 className="bs-heading">{heading}</h2>
      <p className="bs-subheading">{subheading}</p>
      <Ornament />
      {notice && <p className="bs-notice">{notice}</p>}
      {books.length === 0 ? (
        <p className="bs-notice">No volumes could be verified for this shelf.</p>
      ) : (
        <ol className="bs-shelf">
          {books.map((b: Book) => (
            <li key={b.id} className="bs-card">
              <button className="bs-link" onClick={() => openExternal({ url: b.url })} title={`Open ${b.title} on Open Library`}>
                <Cover book={b} />
                <span className="bs-title">{b.title}</span>
              </button>
              <span className="bs-author">{b.author}</span>
              <span className="bs-reason">{b.reason}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="bs-colophon">
        {source === "open_library_only" ? "Drawn from Open Library" : "Every volume verified on Open Library"}
      </p>
    </Frame>
  );
}
