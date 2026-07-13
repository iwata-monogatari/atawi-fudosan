(() => {
  const body = document.body;
  const site = body.dataset.site || "";
  const pageType = body.dataset.pageType || "";
  const navToggle = document.getElementById("navToggle");
  const menu = document.getElementById("menu");
  if (navToggle && menu) {
    navToggle.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function track(eventName, extra = {}) {
    const payload = { event: eventName, site, page_type: pageType, ...extra };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    if (typeof window.gtag === "function") window.gtag("event", eventName, payload);
  }
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-track]");
    if (!target) return;
    track(target.dataset.track, {
      cta_type: target.dataset.cta || "",
      href: target.getAttribute("href") || ""
    });
  });
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) track("faq_open", { question: item.querySelector("summary")?.textContent?.trim() || "" });
    });
  });
  const diagnosisForm = document.getElementById("diagnosisForm");
  if (diagnosisForm) {
    const dataNode = document.getElementById("diagnosisData");
    const data = dataNode ? JSON.parse(dataNode.textContent) : { results: [] };
    track("check_start");
    diagnosisForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const answers = Array.from(new FormData(diagnosisForm).values());
      const result = data.results.find((r) => r[1].some((value) => answers.includes(value))) || data.results[data.results.length - 1];
      const panel = document.getElementById("diagnosisResult");
      if (!panel || !result) return;
      panel.hidden = false;
      panel.innerHTML = '<p class="eyebrow">RESULT</p><h2>' + result[2] + '</h2><p>' + result[3] + '</p><div class="cta-actions"><a class="btn btn-line" href="https://line.me/R/ti/p/%40531nwfsc" target="_blank" rel="noopener" data-track="check_result_line_click" data-cta="line">LINEで結果を相談する</a><a class="btn btn-secondary" href="tel:0538-31-3308" data-track="cta_tel_click" data-cta="tel">電話する 0538-31-3308</a></div>';
      track("check_complete", { diagnosis_result: result[0] });
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  document.querySelectorAll("[data-mail-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const lines = [];
      for (const [key, value] of data.entries()) lines.push(key + ": " + value);
      const subject = encodeURIComponent(form.dataset.subject || "相談");
      const bodyText = encodeURIComponent(lines.join("\n"));
      const email = form.dataset.email;
      track("cta_mail_click", { cta_type: "mail_form" });
      window.location.href = "mailto:" + email + "?subject=" + subject + "&body=" + bodyText;
    });
  });
})();