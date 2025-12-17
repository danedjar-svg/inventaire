// =========================================================
//   ETAT GLOBAL
// =========================================================

let produitsParCode = {};

function $(id) {
  return document.getElementById(id);
}

// =========================================================
//   LOGIN / LOGOUT
// =========================================================

function login() {
  const u = ($("login_username").value || "").trim();
  const p = ($("login_password").value || "").trim();

  if (u === "admin" && p === "1234") {
    $("login_error").textContent = "";
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";
    getData();
  } else {
    $("login_error").textContent = "Identifiants incorrects";
  }
}

function logout() {
  $("login_username").value = "";
  $("login_password").value = "";
  $("login_error").textContent = "";
  $("inventory_section").style.display = "none";
  $("login_section").style.display = "block";
}

// =========================================================
//   CHARGEMENT CSV + TABLE
// =========================================================

function getData() {
  fetch("Data.csv")
    .then(r => r.text())
    .then(csvText => {

      try {
        const saved = localStorage.getItem("stockCSV");
        if (saved) csvText = saved;
      } catch (e) {}

      produitsParCode = {};

      const lignes = csvText.trim().split("\n").filter(l => l.trim() !== "");
      if (lignes.length < 2) return;

      const headers = lignes[0].split(",").map(h => h.trim());

      const productDiv = $("product");
      productDiv.innerHTML = "";

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontFamily = "system-ui, Arial";
      table.style.fontSize = "14px";
      table.style.border = "1px solid #ddd";
      table.style.borderRadius = "10px";
      table.style.overflow = "hidden";

      // ===== THEAD =====
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");

      headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.padding = "10px";
        th.style.background = "#f6f7f9";
        th.style.borderBottom = "1px solid #ddd";
        th.style.textAlign = "left";
        trh.appendChild(th);
      });

      const thA = document.createElement("th");
      thA.textContent = "Actions";
      thA.style.padding = "10px";
      thA.style.background = "#f6f7f9";
      trh.appendChild(thA);

      thead.appendChild(trh);
      table.appendChild(thead);

      // ===== TBODY =====
      const tbody = document.createElement("tbody");
      tbody.id = "productBody";

      const select = $("productSelect");
      select.innerHTML = `<option value="">-- Sélectionnez un produit --</option>`;

      const createRow = (vals) => {
        const code = vals[0]?.trim();
        const nom = vals[1]?.trim();
        if (!code) return null;

        const tr = document.createElement("tr");

        vals.forEach(v => {
          const td = document.createElement("td");
          td.textContent = (v ?? "").trim();
          td.style.padding = "10px";
          td.style.borderBottom = "1px solid #eee";
          tr.appendChild(td);
        });

        // Actions
        const tdA = document.createElement("td");
        tdA.style.padding = "8px";
        tdA.style.whiteSpace = "nowrap";

        const btn = (txt, fn) => {
          const b = document.createElement("button");
          b.textContent = txt;
          b.style.padding = "6px 10px";
          b.style.marginRight = "4px";
          b.style.border = "1px solid #cfd6e4";
          b.style.borderRadius = "8px";
          b.style.background = "#fff";
          b.style.cursor = "pointer";
          b.onclick = fn;
          return b;
        };

        tdA.appendChild(btn("+", () => { select.value = code; afficherProduit(); stock(); }));
        tdA.appendChild(btn("-", () => { select.value = code; afficherProduit(); retrait(); }));

        tr.appendChild(tdA);

        // hover léger
        tr.addEventListener("mouseenter", () => {
          if (produitsParCode[code].lastZone === "ok")
            tr.style.boxShadow = "inset 0 0 0 9999px rgba(60,120,255,0.08)";
        });
        tr.addEventListener("mouseleave", () => tr.style.boxShadow = "");

        produitsParCode[code] = {
          nom,
          row: tr,
          stockCell: tr.children[2],
          lastZone: null
        };

        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = `${code} - ${nom}`;
        select.appendChild(opt);

        mettreAJourEtatLigne(code);
        return tr;
      };

      for (let i = 1; i < lignes.length; i++) {
        const tr = createRow(lignes[i].split(","));
        if (tr) tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      productDiv.appendChild(table);

      if (select.options.length > 1) {
        select.selectedIndex = 1;
        afficherProduit();
      }
    });
}

// =========================================================
//   AFFICHAGE PRODUIT
// =========================================================

function afficherProduit() {
  const code = $("productSelect").value;
  const p = produitsParCode[code];
  if (!p) return;
  $("affichage_nom").textContent = p.nom;
  $("affichage_stock").textContent = p.stockCell.textContent;
}

// =========================================================
//   COULEURS + ALERTES
// =========================================================

function zonePourStock(stock, min, max) {
  if (stock < 0) return "negatif";
  if (!isNaN(min) && stock < min) return "sous_min";
  if (!isNaN(max) && stock > max) return "au_dessus_max";
  return "ok";
}

function mettreAJourEtatLigne(code) {
  const p = produitsParCode[code];
  if (!p) return;

  const tr = p.row;
  const stock = parseInt(p.stockCell.textContent, 10);
  const min = parseInt(tr.children[3]?.textContent || "", 10);
  const max = parseInt(tr.children[4]?.textContent || "", 10);

  const z = zonePourStock(stock, min, max);

  tr.style.backgroundColor = "";
  tr.style.fontWeight = "";

  if (z === "negatif") {
    tr.style.backgroundColor = "#ffd6d6";
    tr.style.fontWeight = "700";
  } else if (z === "sous_min") {
    tr.style.backgroundColor = "#fff1cc";
  } else if (z === "au_dessus_max") {
    tr.style.backgroundColor = "#e6f3ff";
  }

  if (p.lastZone && p.lastZone !== z) {
    alert(`⚠ ${p.nom} : stock ${stock}`);
  }
  p.lastZone = z;
}

// =========================================================
//   STOCK
// =========================================================

function ecrireStock(code, v) {
  const p = produitsParCode[code];
  p.stockCell.textContent = v;
  $("affichage_stock").textContent = v;
  mettreAJourEtatLigne(code);
}

function stock() {
  const code = $("productSelect").value;
  if (!code) return;
  ecrireStock(code, parseInt(produitsParCode[code].stockCell.textContent, 10) + 1);
}

function retrait() {
  const code = $("productSelect").value;
  if (!code) return;
  ecrireStock(code, parseInt(produitsParCode[code].stockCell.textContent, 10) - 1);
}

// =========================================================
//   SAUVEGARDE / EXPORT
// =========================================================

function tableVersCSV() {
  const rows = [...document.querySelectorAll("#productBody tr")];
  return rows.map(r =>
    [...r.children].slice(0, 5).map(td => td.textContent).join(",")
  ).join("\n");
}

function sauvegarderDansNavigateur() {
  localStorage.setItem("stockCSV", tableVersCSV());
  alert("Sauvegardé");
}

function exporterCSV() {
  const blob = new Blob([tableVersCSV()], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stock.csv";
  a.click();
}
