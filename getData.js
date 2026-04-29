// ===============================
//   CONFIG
// ===============================
const LOGIN_KEY = "inventaire_logged_in";

// ===============================
//   STATE
// ===============================
let produitsParCode = {};
let selectedCode = "";
let allProductsData = [];
let stockFilterMode = "all"; // all | hide0 | only0

// ===============================
//   NORMALISATION CODE BARRE
// ===============================
function normalizeCode(code) {
  return String(code)
    .trim()
    .toUpperCase()
    .replace(/R2N/g, "")
    .replace(/\.LC/g, "")
    .replace(/LC/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "");
}

// ===============================
//   HELPERS
// ===============================
function $(id) {
  return document.getElementById(id);
}

function toNum(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

// ===============================
//   SELECTION
// ===============================
function clearSelectionHighlight() {
  Object.values(produitsParCode).forEach(p => {
    if (p.row) p.row.classList.remove("status-selected");
  });
}

function setSelected(code) {
  selectedCode = normalizeCode(code || "");
  clearSelectionHighlight();

  const info = produitsParCode[selectedCode];

  if (!selectedCode || !info) {
    $("affichage_stock").textContent = "stock : 0";
    return;
  }

  info.row.classList.add("status-selected");
  $("affichage_stock").textContent =
    "stock : " + toNum(info.stockCell.textContent, 0);
}

// ===============================
//   COULEURS STOCK
// ===============================
function updateRowStatus(tr) {
  const tds = tr.querySelectorAll("td");
  if (tds.length < 5) return;

  const stock = toNum(tds[2].textContent, 0);
  const stockMin = toNum(tds[3].textContent, 0);
  const stockMax = toNum(tds[4].textContent, 0);

  tr.classList.remove("status-good", "status-warning", "status-danger");

  if (stock < 0 || stock < stockMin || stock > stockMax) {
    tr.classList.add("status-danger");
  } else if (stock === stockMin + 1 || stock === stockMax - 1) {
    tr.classList.add("status-warning");
  } else {
    tr.classList.add("status-good");
  }
}

// ===============================
//   LOGIN
// ===============================
async function login() {
  const email = $("login_email").value.trim();
  const password = $("login_password").value.trim();

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    $("login_error").style.display = "block";
    return;
  }

  localStorage.setItem(LOGIN_KEY, "1");
  $("login_section").style.display = "none";
  $("inventory_section").style.display = "block";
  $("login_error").style.display = "none";

  getData();
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem(LOGIN_KEY);

  $("login_section").style.display = "block";
  $("inventory_section").style.display = "none";
}

// ===============================
//   MENU DEROULANT PRODUITS
// ===============================
function rebuildDropdown() {
  const select = $("productSelect");
  select.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';

  Object.entries(produitsParCode).forEach(([code, info]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = info.nom;
    select.appendChild(option);
  });

  select.onchange = function () {
    setSelected(this.value);
  };
}

// ===============================
//   BOUTONS ACTIONS TABLEAU
// ===============================
function ajouterCelluleActions(tr, codeBarre) {
  const td = document.createElement("td");

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

  td.appendChild(btnPlus);
  td.appendChild(btnMoins);
  tr.appendChild(td);
}

// ===============================
//   CHARGEMENT DONNEES SUPABASE
// ===============================
async function getData() {
  const { data, error } = await supabaseClient
    .from("produit")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    console.error("Erreur Supabase :", error);
    alert("Erreur Supabase : " + error.message);
    return;
  }

  allProductsData = data || [];
  applyFilters();
}

// ===============================
//   FILTRE STOCK TYPE EXCEL
// ===============================
function applyFilters() {
  let filteredData = [...allProductsData];

  if (stockFilterMode === "hide0") {
    filteredData = filteredData.filter(item => toNum(item.stock, 0) !== 0);
  }

  if (stockFilterMode === "only0") {
    filteredData = filteredData.filter(item => toNum(item.stock, 0) === 0);
  }

  renderTable(filteredData);
}

// ===============================
//   AFFICHAGE TABLEAU
// ===============================
function renderTable(data) {
  produitsParCode = {};
  $("product").innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const trHead = document.createElement("tr");

  // Code barre
  const thCode = document.createElement("th");
  thCode.textContent = "Code barre";
  trHead.appendChild(thCode);

  // Nom
  const thNom = document.createElement("th");
  thNom.textContent = "Nom";
  trHead.appendChild(thNom);

  // Stock avec filtre
  const thStock = document.createElement("th");
  const selectFilter = document.createElement("select");

  selectFilter.innerHTML = `
    <option value="all">Stock : Tous</option>
    <option value="hide0">Masquer stock 0</option>
    <option value="only0">Seulement stock 0</option>
  `;

  selectFilter.value = stockFilterMode;

  selectFilter.onchange = function () {
    stockFilterMode = this.value;
    applyFilters();
  };

  thStock.appendChild(selectFilter);
  trHead.appendChild(thStock);

  // Min
  const thMin = document.createElement("th");
  thMin.textContent = "Min";
  trHead.appendChild(thMin);

  // Max
  const thMax = document.createElement("th");
  thMax.textContent = "Max";
  trHead.appendChild(thMax);

  // Actions
  const thActions = document.createElement("th");
  thActions.textContent = "Actions";
  trHead.appendChild(thActions);

  thead.appendChild(trHead);
  table.appendChild(thead);

  data.forEach(item => {
    const code = normalizeCode(item.code_barre);
    const nom = item.nom || "";

    const tr = document.createElement("tr");

    const valeurs = [
      code,
      nom,
      item.stock ?? 0,
      item.stock_min ?? 1,
      item.stock_max ?? 7
    ];

    valeurs.forEach((val, index) => {
      const td = document.createElement("td");
      td.textContent = val;

      if (index === 2) {
        td.classList.add("stockCell");
      }

      tr.appendChild(td);
    });

    ajouterCelluleActions(tr, code);

    tr.onclick = function (event) {
      if (event.target.tagName === "BUTTON" || event.target.tagName === "SELECT") return;

      $("productSelect").value = code;
      setSelected(code);
    };

    tbody.appendChild(tr);

    produitsParCode[code] = {
      nom,
      row: tr,
      stockCell: tr.querySelector(".stockCell")
    };

    updateRowStatus(tr);
  });

  table.appendChild(tbody);
  $("product").appendChild(table);

  rebuildDropdown();
}

// ===============================
//   ACTIONS STOCK
// ===============================
async function stock() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!code || !info) {
    alert("Choisis un produit.");
    return;
  }

  const nouveau = toNum(info.stockCell.textContent, 0) + 1;

  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  if (error) {
    console.error(error);
    alert("Erreur mise à jour stock.");
    return;
  }

  await getData();
  $("productSelect").value = code;
  setSelected(code);
}

async function retrait() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!code || !info) {
    alert("Choisis un produit.");
    return;
  }

  const nouveau = toNum(info.stockCell.textContent, 0) - 1;

  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  if (error) {
    console.error(error);
    alert("Erreur mise à jour stock.");
    return;
  }

  await getData();
  $("productSelect").value = code;
  setSelected(code);
}

async function definirStock() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!code || !info) {
    alert("Choisis un produit.");
    return;
  }

  const saisie = $("input_stock").value.trim();
  const actuel = toNum(info.stockCell.textContent, 0);
  let nouveau;

  if (saisie.startsWith("+")) {
    nouveau = actuel + toNum(saisie.slice(1), NaN);
  } else if (saisie.startsWith("-")) {
    nouveau = actuel - toNum(saisie.slice(1), NaN);
  } else {
    nouveau = toNum(saisie, NaN);
  }

  if (!Number.isFinite(nouveau)) {
    alert("Saisie invalide.");
    return;
  }

  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  if (error) {
    console.error(error);
    alert("Erreur mise à jour stock.");
    return;
  }

  $("input_stock").value = "";
  await getData();
  $("productSelect").value = code;
  setSelected(code);
}

// ===============================
//   AJOUT PRODUIT
// ===============================
async function addProduct() {
  const code = normalizeCode($("new_code").value);
  const nom = $("new_nom").value.trim();

  if (!code || !nom) {
    alert("Code barre et nom obligatoires.");
    return;
  }

  const { error } = await supabaseClient.from("produit").insert([{
    code_barre: code,
    nom,
    stock: toNum($("new_stock").value, 0),
    stock_min: toNum($("new_stock_min").value, 1),
    stock_max: toNum($("new_stock_max").value, 7)
  }]);

  if (error) {
    console.error(error);
    alert("Erreur ajout produit : " + error.message);
    return;
  }

  $("new_code").value = "";
  $("new_nom").value = "";
  $("new_stock").value = "0";
  $("new_stock_min").value = "1";
  $("new_stock_max").value = "7";

  await getData();
}

// ===============================
//   SUPPRESSION PRODUIT
// ===============================
async function deleteProduct() {
  const code = normalizeCode($("delete_code").value);

  if (!code) {
    alert("Scanne ou entre un code barre à supprimer.");
    return;
  }

  const confirmation = confirm("Supprimer le produit : " + code + " ?");
  if (!confirmation) return;

  const { error } = await supabaseClient
    .from("produit")
    .delete()
    .eq("code_barre", code);

  if (error) {
    console.error(error);
    alert("Erreur suppression produit.");
    return;
  }

  $("delete_code").value = "";
  await getData();
}

// ===============================
//   SCANNER DOUCHETTE
// ===============================
async function handleBarcodeScan(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();

  let code = normalizeCode($("barcode_input").value);
  $("barcode_input").value = code;

  const produit = produitsParCode[code];

  if (!produit) {
    $("barcode_result").textContent = "Produit non trouvé : " + code;
    $("new_code").value = code;
    $("delete_code").value = code;
    return;
  }

  $("productSelect").value = code;
  setSelected(code);

  const choix = prompt(
    "Produit : " + produit.nom +
    "\n\n1 = Ajouter +1 au stock" +
    "\n2 = Retirer -1 du stock"
  );

  if (choix === "1") {
    await stock();
    $("barcode_result").textContent = "Ajout +1 : " + produit.nom;
  } else if (choix === "2") {
    await retrait();
    $("barcode_result").textContent = "Retrait -1 : " + produit.nom;
  } else {
    $("barcode_result").textContent = "Action annulée.";
  }

  $("barcode_input").value = "";
}

// ===============================
//   NETTOYAGE AUTO DES CHAMPS CODE
// ===============================
document.addEventListener("input", function (event) {
  if (
    event.target.id === "barcode_input" ||
    event.target.id === "new_code" ||
    event.target.id === "delete_code"
  ) {
    const cleaned = normalizeCode(event.target.value);
    if (event.target.value !== cleaned) {
      event.target.value = cleaned;
    }
  }
});

// ===============================
//   INIT + TEMPS REEL
// ===============================
document.addEventListener("DOMContentLoaded", async function () {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session || localStorage.getItem(LOGIN_KEY) === "1") {
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";
    getData();
  }

  supabaseClient
    .channel("realtime-produit")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "produit" },
      () => {
        getData();
      }
    )
    .subscribe();
});