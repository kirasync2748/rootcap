/**
 * Wraps every `<pre class="code-block">` in a macOS-style window container
 * with a header bar (traffic-light dots, filename, and a copy button).
 * Used by both the home page and the docs page for a consistent look.
 */
export function addCopyButtons(container: HTMLElement): void {
  const codeBlocks = container.querySelectorAll<HTMLPreElement>("pre.code-block");

  codeBlocks.forEach((block) => {
    // Skip if already wrapped
    if (block.parentElement?.classList.contains("code-block-wrapper")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    block.parentNode?.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    // Window-style header: traffic lights + filename + copy button
    const header = document.createElement("div");
    header.className = "code-block-header";
    header.innerHTML = `
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="code-block-filename">${block.dataset.file || "code"}</span>
    `;

    const button = document.createElement("button");
    button.className = "code-copy-btn";
    button.type = "button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code to clipboard");
    header.appendChild(button);

    button.addEventListener("click", () => {
      const code = block.querySelector("code");
      const text = code?.textContent || block.textContent || "";
      navigator.clipboard
        .writeText(text)
        .then(() => {
          button.textContent = "Copied!";
          button.classList.add("copied");
          setTimeout(() => {
            button.textContent = "Copy";
            button.classList.remove("copied");
          }, 2000);
        })
        .catch(() => {
          button.textContent = "Failed";
          setTimeout(() => {
            button.textContent = "Copy";
          }, 2000);
        });
    });

    wrapper.insertBefore(header, block);
  });
}
