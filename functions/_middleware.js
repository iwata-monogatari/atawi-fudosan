async function fetchFooter(context) {
  const response = await context.env.ASSETS.fetch(
    new URL("/partials/footer.html", context.request.url)
  );

  if (!response.ok) return null;
  return response.text();
}

function isReadRequest(request) {
  return request.method === "GET" || request.method === "HEAD";
}

// amp 系キーを url から取り除く。取り除いたら true。
function stripAmpParams(url) {
  let changed = false;
  for (const key of [...new Set(url.searchParams.keys())]) {
    if (key === "amp" || key.startsWith("amp;") || key === "amp&amp") {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 旧見本PDFには価格目安がなく実費請求の記載も残るため、新しい詳細見本へ案内する。
  if (
    url.pathname === "/karte/sample/pdf/fujigaoka-jikka-karte-sample-a.pdf" ||
    url.pathname === "/karte/sample/pdf/fujigaoka-jikka-karte-sample-b.pdf"
  ) {
    return Response.redirect(new URL("/karte/sample/pdf/fujigaoka-jikka-karte-detail-sample.pdf", url).toString(), 301);
  }

  // 旧AMP由来の「?amp=&amp=」付きURLが索引されている。_redirects はクエリ文字列を
  // 照合できない(Cloudflare Pages の仕様)ため、ここでクエリを落とした正規URLへ301する。
  // 「amp」「amp;amp」(&amp; がそのまま入ったもの)のキーだけを対象にし、他のクエリは維持する。
  if (isReadRequest(context.request) && stripAmpParams(url)) {
    return Response.redirect(url.toString(), 301);
  }

  if (url.searchParams.has("fga_internal")) {
    url.searchParams.delete("fga_internal");
    return Response.redirect(url.toString(), 301);
  }

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
