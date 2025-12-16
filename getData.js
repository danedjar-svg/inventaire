// ===============================
//   CONFIG / ETAT GLOBAL
// ===============================
let produitsParCode = {}; // { code: { nom, row, stockCell } }

function $(id) { return document.getElementById(id); }

// ===============================
//   LOGIN / LOGOUT
// ===============================
function login() {
  const u = ($("login_username").value || "").trim();
  const p = ($("login_password").value || "").trim();

  if (u === "admin" && p === "1234") {
    $("login_error").textContent = "";
    $("login_section").classList.add("hidden");
    $("inventory_section").classList.remove("hidden");
    getData();
  } else {
    $("login_error").textContent = "Identifiants incorrects.";
  }
}

function logout() {
  $("login_username").value = "";
  $("login_password").value = "";
  $("login_section").classList.remove("hidden");
  $("inventory_section").classList.add("hidden");
}

// ===============================
//   CHARGEMENT + CONSTRUCTION TABLE
// ===============================
function getData() {
  fetch("Data.csv")
    .then(r => {
      if (!r.ok) throw new Error("Erreur HTTP : " + r.status);
      return r.text();
    })
    .then(csvText => {
      // Si sauvegarde navigateur existe, on l'utilise
      try {
        const saved = localStorage.getItem("stockCSV");
        if (saved) csvText = saved;
      } catch (e) {}

      produitsParCode = {};

      const lignes = csvText.trim().split("\n").filter(l => l.trim() !== "");
      if (lignes.length < 2) {
        console.warn("CSV vide ou invalide");
        return;
      }

      const headers = lignes[0].split(",").map(h => h.trim());

      // UI
      const productDiv = $("product");
      productDiv.innerHTML = "";

      const table = document.createElement("table");

      // thead
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        trh.appendChild(th);
      });
      const thA = document.createElement("th");
      thA.textContent = "Actions";
      trh.appendChild(thA);
      thead.appendChild(trh);
      table.appendChild(thead);

      // tbody
      const tbody = document.createElement("tbody");
      tbody.id = "productBody";

      // select
      const select = $("productSelect");
      select.innerHTML = "";

      // lignes
      for (let i = 1; i < lignes.length; i++) {
        const vals = lignes[i].split(",").map(v => v.trim());

        const codeBarre = vals[0] || "";
        const nomProduit = vals[1] || "";
        const stockStr = vals[2] || "0";

        const tr = document.createElement("tr");
        tr.dataset.codeBarre = codeBarre;

        vals.forEach(v => {
          const td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        });

        // actions
        const tdActions = document.createElement("td");
        tdActions.className = "actions";

        const btnPlus = document.createElement("button");
        btnPlus.textContent = "+";
        btnPlus.onclick = () => {
          $("productSelect").value = codeBarre;
          stock();
        };

        const btnMoins = document.createElement("button");
        btnMoins.textContent = "-";
        btnMoins.onclick = () => {
          $("productSelect").value = codeBarre;
          retrait();
        };

        const inputLigne = document.createElement("input");
        inputLigne.type = "text";
        inputLigne.size = 6;
        inputLigne.placeholder = "5, +5";

        const btnOK = document.createElement("button");
        btnOK.textContent = "OK";
        btnOK.onclick = () => {
          $("productSelect").value = codeBarre;
          $("input_stock").value = (inputLigne.value || "").trim();
          definirStock();
          inputLigne.value = "";
        };

        // Entrée dans le input de la ligne => OK
        inputLigne.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            btnOK.click();
          }
        });

        const btnSuppr = document.createElement("button");
        btnSuppr.textContent = "Supprimer";
        btnSuppr.onclick = () => {
          if (!confirm("Supprimer ce produit ?")) return;

          tr.remove();
          delete produitsParCode[codeBarre];

          const opt = select.querySelector(`option[value="${codeBarre}"]`);
          if (opt) opt.remove();

          if (select.value === codeBarre) {
            $("affichage_nom").textContent = "";
            $("affichage_stock").textContent = "";
          }

          // re-filtre après suppression
          filtrerProduits();
        };

        tdActions.appendChild(btnPlus);
        tdActions.appendChild(btnMoins);
        tdActions.appendChild(inputLigne);
        tdActions.appendChild(btnOK);
        tdActions.appendChild(btnSuppr);

        tr.appendChild(tdActions);

        // Index attendus: 0 code, 1 nom, 2 stock, 3 min, 4 max
        const stockCell = tr.children[2];

        produitsParCode[codeBarre] = {
          nom: nomProduit,
          row: tr,
          stockCell: stockCell
        };

        // option select
        const option = document.createElement("option");
        option.value = codeBarre;
        option.textContent = `${codeBarre} - ${nomProduit}`;
        select.appendChild(option);

        // couleurs initiales
        mettreAJourEtatLigne(codeBarre);

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      productDiv.appendChild(table);

      // afficher le premier si dispo
      if (select.options.length > 0) {
        select.selectedIndex = 0;
        afficherProduit();
      }

      // branche recherche instantanée
      const searchInput = $("searchInput");
      if (searchInput) {
        searchInput.oninput = filtrerProduits;
        filtrerProduits();
      }
    })
    .catch(err => console.error("Erreur chargement CSV :", err));
}

// ===============================
//   AFFICHAGE PRODUIT SELECTIONNE
// ===============================
function afficherProduit() {
  const code = $("productSelect").value;
  const p = produitsParCode[code];
  if (!p) return;

  $("affichage_nom").textContent = p.nom;
  $("affichage_stock").textContent = p.stockCell.textContent;
}

// ===============================
//   MODIF STOCK (GLOBAL)
// ===============================
function definirStock() {
  const code = $("productSelect").value;
  const p = produitsParCode[code];
  if (!p) return;

  const raw = ($("input_stock").value || "").trim();
  if (!raw) return;

  const current = parseInt(p.stockCell.textContent, 10) || 0;

  let next;
  if (/^[+-]\d+$/.test(raw)) {
    next = current + parseInt(raw, 10);
  } else if (/^\d+$/.test(raw)) {
    next = parseInt(raw, 10);
  } else {
    alert("Format invalide. Exemples: 5, +5, -3");
    return;
  }

  p.stockCell.textContent = String(next);
  $("affichage_stock").textContent = String(next);

  mettreAJourEtatLigne(code);
}

// +1
function stock() {
  $("input_stock").value = "+1";
  definirStock();
  $("input_stock").value = "";
}

// -1
function retrait() {
  $("input_stock").value = "-1";
  definirStock();
  $("input_stock").value = "";
}

// ===============================
//   COULEURS MIN/MAX
// ===============================
function mettreAJourEtatLigne(code) {
  const p = produitsParCode[code];
  if (!p) return;

  const tr = p.row;
  tr.classList.remove("row-ok", "row-warn", "row-bad");

  const stock = parseInt(tr.children[2]?.textContent, 10) || 0;
  const min = parseInt(tr.children[3]?.textContent, 10) || 0;
  const max = parseInt(tr.children[4]?.textContent, 10) || 0;

  // Si max/min sont 0, on met "ok"
  if (max <= 0 && min <= 0) {
    tr.classList.add("row-ok");
    return;
  }

  // Rouge si critique
  if (stock <= min || (max > 0 && stock >= max)) {
    tr.classList.add("row-bad");
    return;
  }

  // Orange si proche (20% de la zone)
  const marginMin = min + Math.max(1, Math.round((max - min) * 0.2));
  const marginMax = max - Math.max(1, Math.round((max - min) * 0.2));

  if (stock <= marginMin || (max > 0 && stock >= marginMax)) {
    tr.classList.add("row-warn");
  } else {
    tr.classList.add("row-ok");
  }
}

// ===============================
//   AJOUT PRODUIT
// ===============================
function ajouterProduit() {
  const code = ($("new_code").value || "").trim();
  const nom = ($("new_name").value || "").trim();

  const stock = ($("new_stock").value || "0").trim();
  const min = ($("new_min").value || "0").trim();
  const max = ($("new_max").value || "0").trim();

  if (!code || !nom) {
    alert("Code-barres et nom sont obligatoires.");
    return;
  }
  if (produitsParCode[code]) {
    alert("Ce code-barres existe déjà.");
    return;
  }

  const tbody = document.querySelector("#productBody");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.dataset.codeBarre = code;

  // cellules : code, nom, stock, min, max
  [code, nom, stock, min, max].forEach(v => {
    const td = document.createElement("td");
    td.textContent = v;
    tr.appendChild(td);
  });

  // actions
  const tdActions = document.createElement("td");
  tdActions.className = "actions";

  const btnPlus = document.createElement("button");
  btnPlus.textContent = "+";
  btnPlus.onclick = () => { $("productSelect").value = code; stockFn(); };

  const btnMoins = document.createElement("button");
  btnMoins.textContent = "-";
  btnMoins.onclick = () => { $("productSelect").value = code; retraitFn(); };

  const inputLigne = document.createElement("input");
  inputLigne.type = "text";
  inputLigne.size = 6;
  inputLigne.placeholder = "5, +5";

  const btnOK = document.createElement("button");
  btnOK.textContent = "OK";
  btnOK.onclick = () => {
    $("productSelect").value = code;
    $("input_stock").value = (inputLigne.value || "").trim();
    definirStock();
    inputLigne.value = "";
  };

  inputLigne.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnOK.click();
    }
  });

  const btnSuppr = document.createElement("button");
  btnSuppr.textContent = "Supprimer";
  btnSuppr.onclick = () => {
    if (!confirm("Supprimer ce produit ?")) return;
    tr.remove();
    delete produitsParCode[code];

    const opt = $("productSelect").querySelector(`option[value="${code}"]`);
    if (opt) opt.remove();

    filtrerProduits();
  };

  tdActions.appendChild(btnPlus);
  tdActions.appendChild(btnMoins);
  tdActions.appendChild(inputLigne);
  tdActions.appendChild(btnOK);
  tdActions.appendChild(btnSuppr);

  tr.appendChild(tdActions);

  tbody.appendChild(tr);

  produitsParCode[code] = {
    nom: nom,
    row: tr,
    stockCell: tr.children[2]
  };

  // option select
  const option = document.createElement("option");
  option.value = code;
  option.textContent = `${code} - ${nom}`;
  $("productSelect").appendChild(option);

  // reset inputs
  $("new_code").value = "";
  $("new_name").value = "";
  $("new_stock").value = "";
  $("new_min").value = "";
  $("new_max").value = "";

  // couleurs + filtre
  mettreAJourEtatLigne(code);
  filtrerProduits();

  // sélection automatique
  $("productSelect").value = code;
  afficherProduit();

  // petites fonctions locales pour éviter collision de nom
  function stockFn() { $("input_stock").value = "+1"; definirStock(); $("input_stock").value = ""; }
  function retraitFn() { $("input_stock").value = "-1"; definirStock(); $("input_stock").value = ""; }
}

// ===============================
//   CSV: CONSTRUCTION + SAVE / EXPORT
// ===============================
function construireCSVDepuisTable() {
  const tbody = document.querySelector("#productBody");
  if (!tbody) return "";

  // header fixe correspondant à ton format
  const header = "codeBarre,nom,stock,stockMin,stockMax";

  const lignes = [];
  tbody.querySelectorAll("tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    const code = (tds[0]?.textContent || "").trim();
    const nom = (tds[1]?.textContent || "").trim();
    const stock = (tds[2]?.textContent || "").trim();
    const min = (tds[3]?.textContent || "").trim();
    const max = (tds[4]?.textContent || "").trim();
    lignes.push([code, nom, stock, min, max].join(","));
  });

  return [header, ...lignes].join("\n");
}

function sauvegarderDansNavigateur() {
  const csv = construireCSVDepuisTable();
  try {
    localStorage.setItem("stockCSV", csv);
    alert("Sauvegardé dans le navigateur ✅");
  } catch (e) {
    alert("Impossible de sauvegarder (localStorage bloqué).");
  }
}

function resetSauvegardeNavigateur() {
  try {
    localStorage.removeItem("stockCSV");
    alert("Sauvegarde navigateur supprimée ✅");
    getData();
  } catch (e) {
    alert("Impossible de supprimer la sauvegarde.");
  }
}

function exporterCSV() {
  const csv = construireCSVDepuisTable();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Data_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===============================
//   RECHERCHE INSTANTANÉE
// ===============================
function filtrerProduits() {
  const input = $("searchInput");
  const q = (input?.value || "").trim().toLowerCase();

  document.querySelectorAll("#productBody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    const code = (tds[0]?.textContent || "").toLowerCase();
    const nom = (tds[1]?.textContent || "").toLowerCase();

    const match = q === "" || code.includes(q) || nom.includes(q);
    tr.style.display = match ? "" : "none";
  });
}

function effacerRecherche() {
  const input = $("searchInput");
  if (!input) return;
  input.value = "";
  filtrerProduits();
  input.focus();
}

// ===============================
//   ENTRÉE = VALIDER
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const onEnter = (el, action) => {
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        action();
      }
    });
  };

  // Login
  onEnter($("login_username"), login);
  onEnter($("login_password"), login);

  // Définir stock
  onEnter($("input_stock"), definirStock);

  // Ajout produit (Entrée sur un champ => ajoute)
  const addAction = () => {
    const inv = $("inventory_section");
    if (inv && inv.classList.contains("hidden")) return;
    ajouterProduit();
  };

  ["new_code", "new_name", "new_stock", "new_min", "new_max"].forEach(id => {
    onEnter($(id), addAction);
  });
});
