const LOGIN_KEY = "inventaire_logged_in";

let produitsParCode = {};
let selectedCode = "";
let allProductsData = [];
let stockFilterMode = "all"; // all | hide0 | only0

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

function $(id) {
  return document.getElementById(id);
}

function toNum(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function clearSelectionHighlight() {
  Object.values(produitsParCode).forEach(p => {
    if (p.row) p.row.classList.remove("status-selected");
  });
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
  $("affichage_stock").textContent =
    "stock : " + toNum(info.stockCell.textContent, 0);
}

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

  getData();
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem(LOGIN_KEY);

  $("login_section").style.display = "block";
  $("inventory_section").style.display = "none";
}

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

function ajouterCelluleActions(tr, codeBarre) {
  const td = document.createElement("td");

  const btnPlus = document.createElement("button");
  btnPlus.textContent = "+";
  btnPlus.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    stock();
  };

  const btnMoins = document.createElement("button");
  btnMoins.textContent = "-";
  btnMoins.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    retrait();
  };

  td.appendChild(btnPlus);
  td.appendChild(btnMoins);
  tr.appendChild(td);
}

async function getData() {
  const { data, error } = await supabaseClient
    .from("produit")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    alert("Erreur Supabase");
    return;
  }

  allProductsData = data || [];
  applyFilters();
}

function applyFilters() {
  let filteredData = [...allProductsData];

  const hideZero = $("hide_zero_stock") && $("hide_zero_stock").checked;

  if (hideZero) {
    filteredData = filteredData.filter(item => toNum(item.stock, 0) !== 0);
    $("filter_result").textContent =
      filteredData.length + " article(s) affiché(s), stock à 0 masqué.";
  } else {
    $("filter_result").textContent = "Tous les articles sont affichés.";
  }

  renderTable(filteredData);
}

function renderTable(data) {
  produitsParCode = {};
  $("product").innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const trHead = document.createElement("tr");

  // Colonnes
  ["Code barre", "Nom"].forEach(titre => {
    const th = document.createElement("th");
    th.textContent = titre;
    trHead.appendChild(th);
  });

  // 🔥 COLONNE STOCK AVEC FILTRE
  const thStock = document.createElement("th");

  const selectFilter = document.createElement("select");
  selectFilter.innerHTML = `
    <option value="all">Stock (Tous)</option>
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

  ["Min", "Max", "Actions"].forEach(titre => {
    const th = document.createElement("th");
    th.textContent = titre;
    trHead.appendChild(th);
  });

  thead.appendChild(trHead);
  table.appendChild(thead);

  // 🔥 FILTRAGE
  let filteredData = data;

  if (stockFilterMode === "hide0") {
    filteredData = data.filter(item => toNum(item.stock, 0) !== 0);
  }

  if (stockFilterMode === "only0") {
    filteredData = data.filter(item => toNum(item.stock, 0) === 0);
  }

  // Lignes
  filteredData.forEach(item => {
    const code = normalizeCode(item.code_barre);
    const nom = item.nom;

    const tr = document.createElement("tr");

    [code, nom, item.stock, item.stock_min, item.stock_max].forEach((val, i) => {
      const td = document.createElement("td");
      td.textContent = val;
      if (i === 2) td.classList.add("stockCell");
      tr.appendChild(td);
    });

    ajouterCelluleActions(tr, code);

    tr.onclick = function (event) {
      if (event.target.tagName === "BUTTON") return;
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

async function stock() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!info) return alert("Choisis un produit.");

  const nouveau = toNum(info.stockCell.textContent) + 1;

  await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  getData();
}

async function retrait() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!info) return alert("Choisis un produit.");

  const nouveau = toNum(info.stockCell.textContent) - 1;

  await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  getData();
}

async function definirStock() {
  const code = normalizeCode($("productSelect").value);
  const valeur = toNum($("input_stock").value);

  await supabaseClient
    .from("produit")
    .update({ stock: valeur })
    .eq("code_barre", code);

  getData();
}

async function addProduct() {
  const code = normalizeCode($("new_code").value);
  const nom = $("new_nom").value;

  await supabaseClient.from("produit").insert([{
    code_barre: code,
    nom,
    stock: toNum($("new_stock").value),
    stock_min: toNum($("new_stock_min").value),
    stock_max: toNum($("new_stock_max").value)
  }]);

  getData();
}

async function deleteProduct() {
  const code = normalizeCode($("delete_code").value);

  await supabaseClient
    .from("produit")
    .delete()
    .eq("code_barre", code);

  getData();
}

async function handleBarcodeScan(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();

  let code = normalizeCode($("barcode_input").value);
  $("barcode_input").value = code;

  const produit = produitsParCode[code];

  if (!produit) {
    $("barcode_result").textContent = "Produit non trouvé : " + code;
    $("new_code").value = code;
    return;
  }

  $("productSelect").value = code;
  setSelected(code);

  const choix = prompt(
    "Produit : " + produit.nom +
    "\n1 = Ajouter\n2 = Retirer"
  );

  if (choix === "1") await stock();
  else if (choix === "2") await retrait();

  $("barcode_input").value = "";
}

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

document.addEventListener("DOMContentLoaded", async function () {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session || localStorage.getItem(LOGIN_KEY) === "1") {
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";
    getData();
  }

  supabaseClient
    .channel("realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "produit" },
      () => {
        getData();
      }
    )
    .subscribe();
});