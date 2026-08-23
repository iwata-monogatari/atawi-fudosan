async function fetchFooter(context) {
  const response = await context.env.ASSETS.fetch(
    new URL("/partials/footer.html", context.request.url)
  );

  if (!response.ok) return null;
  return response.text();
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith("/partials/")) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  const footerHtml = await fetchFooter(context);
  if (!footerHtml) return response;

  return new HTMLRewriter()
    .on("footer", {
      element(element) {
        element.remove();
      },
    })
    .on("body", {
      element(element) {
        element.append(
          `<footer class="fgo-global-footer-shell">${footerHtml}</footer>`,
          { html: true }
        );
      },
    })
    .transform(response);
}
