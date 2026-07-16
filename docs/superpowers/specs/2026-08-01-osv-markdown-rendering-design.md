# Feature 3: Render OSV Description as Markdown

## Problem

OSV vulnerability descriptions contain markdown formatting (headings, bold, code blocks, links, lists) but the detail page renders them as plain text with `whiteSpace: pre-wrap`. Formatting is lost, reducing readability.

## Solution

Replace plain `<Text>` rendering with `react-markdown` + `rehype-sanitize` in the description card. Frontend-only change.

## Approach

**Approach A (chosen): react-markdown in component**

`react-markdown` is already a project dependency. Add `rehype-sanitize` for security. Swap the description `<Text>` element for a `<ReactMarkdown>` component with Mantine typography styling.

Rejected alternatives:

- Server-side HTML conversion: unnecessary complexity, `dangerouslySetInnerHTML` anti-pattern
- Custom regex parser: fragile, reinvents existing library

## Changes

### 1. New dependency

- `rehype-sanitize` — strips raw HTML, images, iframes, script tags. Uses GitHub's sanitization schema.

### 2. VulnerabilityDetailPage.tsx

Replace in the description card:

```tsx
// Before
<Text style={{ whiteSpace: "pre-wrap" }}>{vm.description}</Text>

// After
<Typography>
    <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
            a: ({ children, href }) => (
                <Anchor href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                </Anchor>
            )
        }}
    >
        {vm.description}
    </ReactMarkdown>
</Typography>
```

- `Typography` (from `@mantine/core`) gives Mantine-consistent typography to rendered HTML
- Custom `a` renderer uses Mantine's `Anchor` with `target="_blank"` and `rel="noopener noreferrer"`
- `rehypeSanitize` strips raw HTML and inline event handlers
- Custom `img` component override returns null to suppress images (default schema allows them)

### 3. No backend changes

`vm.description` remains `string | null`. When null, description card is not rendered (existing guard: `vm.description &&`). When string, rendered as markdown. Purely presentational change.

### 4. Tests

In `VulnerabilityDetailPresenter.test.ts` — no new tests needed (presenter passes description string unchanged).

For rendering verification: manual browser check that markdown renders correctly on detail page. No component-level tests exist for this page (project tests presenters, not React components).

## Security

`rehype-sanitize` defaults to GitHub's sanitization schema:

- Strips `<script>`, `<iframe>`, `<style>`, inline event handlers (`onclick`, etc.)
- Images suppressed via custom `img: () => null` component override (default schema allows `<img>`)
- Allows safe elements: headings, paragraphs, lists, code, links, emphasis, strong
- Links rendered with `rel="noopener noreferrer"` via custom component

## Scope

- Files modified: 1 (`VulnerabilityDetailPage.tsx`)
- New tests: 0 (presenter unchanged; rendering verified manually)
- New dependencies: 1 (`rehype-sanitize`)
- Backend changes: 0
- Presenter changes: 0
