// ===============================
//   CONFIG
// ===============================
const STORAGE_KEY = "inventaireProduits_v2";

// ===============================
//   STATE
// ===============================
let produitsParCode = {}; // code -> { nom, row, stockCell }
let selectedCode = "";

// ===============================
//   HELPERS
// ===============================
function $(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Élément introuvable: #${id} (id manquant dans index.html)`);
  }
  return el;
}

function toNum(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function clearSelectionHighlight() {
  Object.values(produitsParCode).forEach(p => p.row.classList.remove("status-selected"));
}

function setSelected(code) {
  selectedCode = code || "";
  clearSelectionHighlight();

  const info = produitsParCode[selectedCode];
  if (!selectedCode || !info) {
    $("affichage_stock").textContent = "stock : 0";
    return;
  }

  info.row.classList.add("status-selected");
  const stockActuel = toNum(info.stockCell.textContent, 0);
  $("affichage_stock").textContent = "stock : " + stockActuel;
}

// ===============================
//   COULEURS / STATUT DE LIGNE
// ===============================
function updateRowStatus(tr) {
  if (!tr) return;
  const tds = tr.querySelectorAll("td");
  // 0=code,1=nom,2=stock,3=min,4=max
  if (tds.length < 5) return;

  const stock = toNum(tds[2].textContent, 0);

  const minTxt = (tds[3].textContent || "").trim();
  const maxTxt = (tds[4].textContent || "").trim();

  const stockMin = minTxt === "" ? NaN : toNum(minTxt, NaN);
  const stockMax = maxTxt === "" ? NaN : toNum(maxTxt, NaN);

  const hasMin = Number.isFinite(stockMin);
  const hasMax = Number.isFinite(stockMax);

  tr.classList.remove("status-good", "status-warning", "status-danger");

  // ROUGE : négatif OU sous min OU au-dessus max
  const isDanger =
    stock < 0 ||
    (hasMin && stock < stockMin) ||
    (hasMax && stock > stockMax);

  // ORANGE : UNIQUEMENT à 1 de différence (sans être rouge)
  // Donc : stock == min+1 ou stock == max-1
  const isWarning = !isDanger && (
    (hasMin && stock === stockMin + 1) ||
    (hasMax && stock === stockMax - 1)
  );

  tr.classList.add(isDanger ? "status-danger" : (isWarning ? "status-warning" : "status-good"));
}

function updateAllRowsStatus() {
  Object.values(produitsParCode).forEach(p => updateRowStatus(p.row));
}

// ===============================
//   LOCAL STORAGE
// ===============================
function loadSavedState() {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

function saveCurrentState() {
  const state = {};
  Object.entries(produitsParCode).forEach(([code, info]) => {
    const tds = info.row.querySelectorAll("td");
    state[code] = {
      code: tds[0].textContent,
      nom: tds[1].textContent,
      stock: toNum(tds[2].textContent, 0),
      stockMin: tds[3].textContent,
      stockMax: tds[4].textContent,
      deleted: false
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ===============================
//   LOGIN
// ===============================
function login() {
  const u = $("login_username").value.trim();
  const p = $("login_password").value.trim();

  if (u === "admin" && p === "1234") {
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";
    $("login_error").style.display = "none";
    getData();
  } else {
    $("login_error").style.display = "block";
  }
}

function logout() {
  $("login_section").style.display = "block";
  $("inventory_section").style.display = "none";
  $("login_username").value = "";
  $("login_password").value = "";
  $("login_error").style.display = "none";

  $("product").innerHTML = "";
  $("productSelect").innerHTML = '<option value="">-- Sélectionnez un produit --</option>';

  produitsParCode = {};
  selectedCode = "";
  $("affichage_stock").textContent = "stock : 0";
}

// ===============================
//   TABLE BUILD
// ===============================
function ajouterCelluleActions(tr, codeBarre) {
  const tdActions = document.createElement("td");

  const wrap = document.createElement("div");
  wrap.className = "row-actions";

  const btnPlus = document.createElement("button");
  btnPlus.textContent = "+";
  btnPlus.type = "button";
  btnPlus.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    stock();
  };

  const btnMoins = document.createElement("button");
  btnMoins.textContent = "-";
  btnMoins.type = "button";
  btnMoins.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    retrait();
  };

  const inputLigne = document.createElement("input");
  inputLigne.type = "text";
  inputLigne.placeholder = "5, +5, -3";

  const btnOk = document.createElement("button");
  btnOk.textContent = "OK";
  btnOk.type = "button";
  btnOk.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    $("input_stock").value = inputLigne.value.trim();
    definirStock();
    inputLigne.value = "";
  };

  wrap.appendChild(btnPlus);
  wrap.appendChild(btnMoins);
  wrap.appendChild(inputLigne);
  wrap.appendChild(btnOk);

  tdActions.appendChild(wrap);
  tr.appendChild(tdActions);
}

function rebuildDropdown() {
  const select = $("productSelect");
  const current = select.value;

  select.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';

  Object.entries(produitsParCode).forEach(([code, info]) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = info.nom || code;
    select.appendChild(opt);
  });

  select.value = current;
}

// ===============================
//   LOAD CSV
// ===============================
function getData() {
  fetch("Data.csv")
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(csv => {
      produitsParCode = {};
      selectedCode = "";

      const productDiv = $("product");
      productDiv.innerHTML = "";

      const lignes = csv.trim().split("\n").filter(l => l.trim() !== "");
      if (lignes.length < 2) {
        productDiv.textContent = "CSV vide ou invalide.";
        return;
      }

      const entetes = lignes[0].split(",");

      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const tbody = document.createElement("tbody");

      const trHead = document.createElement("tr");
      entetes.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        trHead.appendChild(th);
      });
      const thActions = document.createElement("th");
      thActions.textContent = "Actions";
      trHead.appendChild(thActions);
      thead.appendChild(trHead);
      table.appendChild(thead);

      for (let i = 1; i < lignes.length; i++) {
        const vals = lignes[i].split(",");
        if (vals.length < 5) continue;

        const code = (vals[0] || "").trim();
        const nom = (vals[1] || "").trim();

        const tr = document.createElement("tr");
        tr.dataset.codeBarre = code;

        vals.slice(0, 5).forEach((v, idx) => {
          const td = document.createElement("td");
          td.textContent = (v ?? "").trim();
          if (idx === 2) td.classList.add("stockCell");
          tr.appendChild(td);
        });

        ajouterCelluleActions(tr, code);

        tr.addEventListener("click", (e) => {
          if (e.target && (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT")) return;
          $("productSelect").value = code;
          setSelected(code);
        });

        tbody.appendChild(tr);

        produitsParCode[code] = {
          nom,
          row: tr,
          stockCell: tr.querySelector(".stockCell")
        };

        updateRowStatus(tr);
      }

      table.appendChild(tbody);
      productDiv.appendChild(table);

      // Applique sauvegarde locale (si existe)
      const saved = loadSavedState();
      Object.keys(saved).forEach(code => {
        const data = saved[code];
        if (!data || data.deleted) return;
        const info = produitsParCode[code];
        if (!info) return;

        const tds = info.row.querySelectorAll("td");
        tds[1].textContent = data.nom;
        tds[2].textContent = data.stock;
        tds[3].textContent = data.stockMin;
        tds[4].textContent = data.stockMax;
        info.nom = data.nom;

        updateRowStatus(info.row);
      });

      rebuildDropdown();

      $("productSelect").onchange = function () {
        setSelected(this.value);
      };

      setSelected("");
      updateAllRowsStatus();
    })
    .catch(err => {
      console.error(err);
      alert("Impossible de charger Data.csv (mets Data.csv au même endroit que index.html).");
    });
}

// ===============================
//   ACTIONS STOCK
// ===============================
function stock() {
  const code = $("productSelect").value;
  const info = produitsParCode[code];
  if (!code || !info) return alert("Choisis un produit.");

  const s = toNum(info.stockCell.textContent, 0) + 1;
  info.stockCell.textContent = s;

  $("affichage_stock").textContent = "stock : " + s;

  updateRowStatus(info.row);
  saveCurrentState();
}

function retrait() {
  const code = $("productSelect").value;
  const info = produitsParCode[code];
  if (!code || !info) return alert("Choisis un produit.");

  const s = toNum(info.stockCell.textContent, 0) - 1;
  info.stockCell.textContent = s;

  $("affichage_stock").textContent = "stock : " + s;

  updateRowStatus(info.row);
  saveCurrentState();
}

function definirStock() {
  const code = $("productSelect").value;
  const info = produitsParCode[code];
  if (!code || !info) return alert("Choisis un produit.");

  const saisie = $("input_stock").value.trim();
  if (!saisie) return alert("Entre un nombre (ex: 5, +5, -5).");

  const actuel = toNum(info.stockCell.textContent, 0);
  let nouveau;

  if (saisie.startsWith("+")) {
    nouveau = actuel + toNum(saisie.slice(1), NaN);
  } else if (saisie.startsWith("-")) {
    nouveau = actuel - toNum(saisie.slice(1), NaN);
  } else {
    nouveau = toNum(saisie, NaN);
  }

  if (!Number.isFinite(nouveau)) return alert("Saisie invalide.");

  info.stockCell.textContent = nouveau;
  $("affichage_stock").textContent = "stock : " + nouveau;
  $("input_stock").value = "";

  updateRowStatus(info.row);
  saveCurrentState();
}

// ===============================
//   AJOUT PRODUIT
// ===============================
function addProduct() {
  const code = $("new_code").value.trim();
  const nom = $("new_nom").value.trim();
  const stockInit = toNum($("new_stock").value, 0);
  const min = toNum($("new_stock_min").value, 0);
  const max = toNum($("new_stock_max").value, 0);

  if (!code || !nom) return alert("Code barre et nom obligatoires.");
  if (produitsParCode[code]) return alert("Ce code existe déjà.");

  const table = document.querySelector("#product table");
  if (!table) return alert("Tableau non chargé (Data.csv introuvable ?)");

  const tbody = table.querySelector("tbody");

  const tr = document.createElement("tr");
  tr.dataset.codeBarre = code;

  const vals = [code, nom, stockInit, min, max];
  vals.forEach((v, idx) => {
    const td = document.createElement("td");
    td.textContent = v;
    if (idx === 2) td.classList.add("stockCell");
    tr.appendChild(td);
  });

  ajouterCelluleActions(tr, code);

  tr.addEventListener("click", (e) => {
    if (e.target && (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT")) return;
    $("productSelect").value = code;
    setSelected(code);
  });

  tbody.appendChild(tr);

  produitsParCode[code] = {
    nom,
    row: tr,
    stockCell: tr.querySelector(".stockCell")
  };

  updateRowStatus(tr);
  rebuildDropdown();
  saveCurrentState();

  $("new_code").value = "";
  $("new_nom").value = "";
  $("new_stock").value = "0";
  $("new_stock_min").value = "0";
  $("new_stock_max").value = "0";
}
