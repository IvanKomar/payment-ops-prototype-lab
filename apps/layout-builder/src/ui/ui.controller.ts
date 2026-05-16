import { Controller, Get, Header } from "@nestjs/common";

@Controller()
export class UiController {
  @Get()
  @Header("Content-Type", "text/html; charset=utf-8")
  getIndex(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Layout Builder</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f6f9;
        --panel: #ffffff;
        --text: #182230;
        --muted: #667085;
        --line: #d7dee8;
        --primary: #1f6f68;
        --primary-strong: #17534e;
        --danger: #b42318;
        --ok: #087443;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .shell {
        display: grid;
        grid-template-columns: 280px minmax(0, 1fr);
        min-height: 100vh;
      }

      aside {
        border-right: 1px solid var(--line);
        background: #ffffff;
        padding: 22px 16px;
      }

      main {
        padding: 28px;
      }

      h1, h2, h3 {
        margin: 0;
        letter-spacing: 0;
      }

      h1 {
        font-size: 24px;
        line-height: 1.2;
      }

      h2 {
        font-size: 18px;
        line-height: 1.25;
      }

      h3 {
        font-size: 14px;
        line-height: 1.25;
      }

      .muted {
        color: var(--muted);
        font-size: 13px;
      }

      .brand-list {
        display: grid;
        gap: 8px;
        margin-top: 18px;
      }

      .brand-item {
        width: 100%;
        min-height: 58px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #ffffff;
        color: var(--text);
        padding: 10px;
        text-align: left;
        cursor: pointer;
      }

      .brand-item.active {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(31, 111, 104, 0.13);
      }

      .brand-name {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 760;
      }

      .swatches {
        display: flex;
        gap: 5px;
        margin-top: 8px;
      }

      .swatch {
        width: 18px;
        height: 18px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 50%;
      }

      .topbar {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 18px;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
        gap: 16px;
      }

      section {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 18px;
      }

      form {
        display: grid;
        gap: 14px;
        margin-top: 16px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 700;
      }

      input[type="text"], input[type="file"], textarea {
        width: 100%;
        border: 1px solid #c7ced9;
        border-radius: 6px;
        padding: 10px 12px;
        color: var(--text);
        font: inherit;
        font-size: 14px;
        outline: none;
      }

      textarea {
        min-height: 300px;
        resize: vertical;
        font-family: "SFMono-Regular", Consolas, monospace;
        line-height: 1.45;
      }

      input:focus, textarea:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(31, 111, 104, 0.13);
      }

      button {
        min-height: 40px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--primary);
        color: #ffffff;
        padding: 9px 14px;
        font: inherit;
        font-weight: 760;
        cursor: pointer;
      }

      button.secondary {
        border-color: #bcc6d3;
        background: #ffffff;
        color: var(--text);
      }

      button:disabled {
        cursor: wait;
        opacity: 0.7;
      }

      button:not(:disabled):hover {
        background: var(--primary-strong);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .status {
        min-height: 20px;
        margin-top: 12px;
        color: var(--muted);
        font-size: 14px;
      }

      .status.error { color: var(--danger); }
      .status.ok { color: var(--ok); }

      .schema-box {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }

      .field {
        border: 1px solid #d7dee8;
        border-radius: 6px;
        padding: 10px;
      }

      .field span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .field strong {
        display: block;
        margin-top: 4px;
        overflow-wrap: anywhere;
        font-size: 14px;
      }

      .preview {
        min-height: 520px;
        overflow: auto;
        margin-top: 16px;
        border: 1px solid #d7dee8;
        border-radius: 8px;
        background: #eef2f6;
        padding: 14px;
      }

      .preview svg {
        display: block;
        width: 100%;
        min-width: 760px;
        height: auto;
      }

      @media (max-width: 980px) {
        .shell, .grid {
          grid-template-columns: 1fr;
        }

        aside {
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }

        main {
          padding: 18px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside>
        <h1>Layout Builder</h1>
        <p class="muted">Brands</p>
        <div id="brandList" class="brand-list"></div>
      </aside>
      <main>
        <div class="topbar">
          <div>
            <h2>Dynamic Brand Layout</h2>
            <div class="muted">Upload a logo, configure the generated endpoint, compare brands.</div>
          </div>
          <button class="secondary" id="refreshBrands" type="button">Refresh</button>
        </div>
        <div class="grid">
          <div>
            <section>
              <h2>Create Brand</h2>
              <form id="brandForm">
                <label>
                  Brand name
                  <input id="brandName" name="brandName" type="text" value="KOI" maxlength="80" required />
                </label>
                <label>
                  Logo
                  <input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required />
                </label>
                <div class="actions">
                  <button id="createButton" type="submit">Create</button>
                </div>
              </form>
              <div id="createStatus" class="status"></div>
            </section>
            <section style="margin-top: 16px;">
              <h2>Generated Schema</h2>
              <div id="schemaBox" class="schema-box"></div>
            </section>
          </div>
          <section>
            <h2>Payload And Preview</h2>
            <form id="payloadForm">
              <label>
                Generated payload
                <textarea id="payload"></textarea>
              </label>
              <div class="actions">
                <button id="submitPayload" type="submit">Submit Config</button>
                <button id="loadLayout" class="secondary" type="button">Reload Layout</button>
              </div>
            </form>
            <div id="payloadStatus" class="status"></div>
            <div id="preview" class="preview"></div>
          </section>
        </div>
      </main>
    </div>
    <script>
      const brandList = document.querySelector("#brandList");
      const brandForm = document.querySelector("#brandForm");
      const brandName = document.querySelector("#brandName");
      const logo = document.querySelector("#logo");
      const createStatus = document.querySelector("#createStatus");
      const schemaBox = document.querySelector("#schemaBox");
      const payloadForm = document.querySelector("#payloadForm");
      const payload = document.querySelector("#payload");
      const payloadStatus = document.querySelector("#payloadStatus");
      const preview = document.querySelector("#preview");
      const refreshBrands = document.querySelector("#refreshBrands");
      const loadLayout = document.querySelector("#loadLayout");
      let selectedBrand = null;
      let selectedSchema = null;

      async function requestJson(url, options) {
        const response = await fetch(url, options);
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        if (!response.ok) {
          throw new Error(data?.message || response.statusText);
        }

        return data;
      }

      async function requestText(url) {
        const response = await fetch(url);
        const text = await response.text();

        if (!response.ok) {
          throw new Error(text || response.statusText);
        }

        return text;
      }

      function setStatus(node, text, kind = "") {
        node.textContent = text;
        node.className = "status" + (kind ? " " + kind : "");
      }

      function renderBrands(brands) {
        if (!brands.length) {
          brandList.innerHTML = '<div class="muted">No brands yet.</div>';
          return;
        }

        brandList.innerHTML = "";
        for (const brand of brands) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "brand-item" + (selectedBrand?.brandId === brand.brandId ? " active" : "");
          button.innerHTML =
            '<span class="brand-name"></span><span class="muted"></span><span class="swatches"></span>';
          button.querySelector(".brand-name").textContent = brand.name;
          button.querySelector(".muted").textContent = brand.logoMimeType;
          const swatches = button.querySelector(".swatches");
          for (const color of [brand.palette.primary, brand.palette.secondary, brand.palette.accent]) {
            const swatch = document.createElement("span");
            swatch.className = "swatch";
            swatch.style.background = color;
            swatches.append(swatch);
          }
          button.addEventListener("click", () => selectBrand(brand.brandId));
          brandList.append(button);
        }
      }

      function renderSchema(schema) {
        selectedSchema = schema;
        schemaBox.innerHTML = "";
        const fields = [
          ["Endpoint", schema.endpoint],
          ["Structure", schema.structure],
          ["Fields style", schema.fieldsStyle],
          ["Layout", schema.layoutVariant]
        ];

        for (const [label, value] of fields) {
          const item = document.createElement("div");
          item.className = "field";
          item.innerHTML = "<span></span><strong></strong>";
          item.querySelector("span").textContent = label;
          item.querySelector("strong").textContent = value;
          schemaBox.append(item);
        }

        payload.value = JSON.stringify(schema.samplePayload, null, 2);
      }

      async function loadBrands() {
        const brands = await requestJson("/brands/recent");
        renderBrands(brands);
        if (!selectedBrand && brands[0]) {
          await selectBrand(brands[0].brandId);
        }
      }

      async function selectBrand(brandId) {
        const schema = await requestJson("/brands/" + encodeURIComponent(brandId) + "/schema");
        selectedBrand = { brandId };
        renderSchema(schema);
        await loadPreview(brandId);
        await loadBrandsWithoutAutoSelect();
      }

      async function loadBrandsWithoutAutoSelect() {
        const brands = await requestJson("/brands/recent");
        renderBrands(brands);
      }

      async function loadPreview(brandId) {
        preview.innerHTML = await requestText("/brands/" + encodeURIComponent(brandId) + "/layout");
      }

      brandForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        createStatus.textContent = "";
        const form = new FormData();
        form.append("brandName", brandName.value);
        form.append("logo", logo.files[0]);

        try {
          const result = await requestJson("/brands", {
            method: "POST",
            body: form
          });
          setStatus(createStatus, "Brand created.", "ok");
          selectedBrand = { brandId: result.brandId };
          renderSchema(result);
          await loadPreview(result.brandId);
          await loadBrandsWithoutAutoSelect();
        } catch (error) {
          setStatus(createStatus, error.message, "error");
        }
      });

      payloadForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!selectedSchema) {
          setStatus(payloadStatus, "Select a brand first.", "error");
          return;
        }

        try {
          const body = JSON.parse(payload.value);
          await requestJson(selectedSchema.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          });
          setStatus(payloadStatus, "Config saved.", "ok");
          await loadPreview(selectedSchema.brandId);
          await loadBrandsWithoutAutoSelect();
        } catch (error) {
          setStatus(payloadStatus, error.message, "error");
        }
      });

      refreshBrands.addEventListener("click", () => {
        void loadBrands();
      });

      loadLayout.addEventListener("click", () => {
        if (selectedSchema) {
          void loadPreview(selectedSchema.brandId);
        }
      });

      void loadBrands();
    </script>
  </body>
</html>`;
  }
}
