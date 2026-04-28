// ===============================
//   CONFIG
// ===============================
const LOGIN_KEY = "inventaire_logged_in";

// ===============================
//   STATE
// ===============================
let produitsParCode = {};
let selectedCode = "";

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
  $("affichage_stock").textContent = "stock : " + toNum(info.stockCell.textContent, 0);
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
//   LOGIN SUPABASE
// ===============================
async function login() {
  const email = $("login_email").value.trim();
  const password = $("login_password").value.trim();

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
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
//   TABLEAU
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

// ===============================
//   CHARGEMENT DONNÉES
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

  produitsParCode = {};

  const productDiv = $("product");
  productDiv.innerHTML = "";

  if (!data || data.length === 0) {
    productDiv.textContent = "Aucun produit dans Supabase.";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const trHead = document.createElement("tr");
  ["Code barre", "Nom", "Stock", "Min", "Max", "Actions"].forEach(titre => {
    const th = document.createElement("th");
    th.textContent = titre;
    trHead.appendChild(th);
  });

  thead.appendChild(trHead);
  table.appendChild(thead);

  data.forEach(item => {
    const code = String(item.code_barre).trim();
    const nom = String(item.nom).trim();

    const tr = document.createElement("tr");

    const valeurs = [
      code,
      nom,
      item.stock ?? 0,
      item.stock_min ?? 1,
      item.stock_max ?? 7
    ];

    valeurs.forEach((valeur, index) => {
      const td = document.createElement("td");
      td.textContent = valeur;
      if (index === 2) td.classList.add("stockCell");
      tr.appendChild(td);
    });

    ajouterCelluleActions(tr, code);

    tr.onclick = function (e) {
      if (e.target.tagName === "BUTTON") return;
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
  productDiv.appendChild(table);

  rebuildDropdown();
}

// ===============================
//   ACTIONS STOCK
// ===============================
async function stock() {
  const code = $("productSelect").value;
  const info = produitsParCode[code];

  if (!code || !info) {
    alert("Choisis un produit.");
    return;
  }

  const nouveauStock = toNum(info.stockCell.textContent, 0) + 1;

  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveauStock })
    .eq("code_barre", code);

  if (error) {
    alert("Erreur mise à jour stock.");
    console.error(error);
    return;
  }

  await getData();
  $("productSelect").value = code;
  setSelected(code);
}

async function retrait() {
  const code = $("productSelect").value;
  const info = produitsParCode[code];

  if (!code || !info) {
    alert("Choisis un produit.");
    return;
  }

  const nouveauStock = toNum(info.stockCell.textContent, 0) - 1;

  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveauStock })
    .eq("code_barre", code);

  if (error) {
    alert("Erreur mise à jour stock.");
    console.error(error);
    return;
  }

  await getData();
  $("productSelect").value = code;
  setSelected(code);
}

async function definirStock() {
  const code = $("productSelect").value;
  const info = produitsParCode[code];

  if (!code || !info) {
    alert("Choisis un produit.");
    return;
  }

  const saisie = $("input_stock").value.trim();
  const actuel = toNum(info.stockCell.textContent, 0);
  let nouveauStock;

  if (saisie.startsWith("+")) {
    nouveauStock = actuel + toNum(saisie.slice(1), NaN);
  } else if (saisie.startsWith("-")) {
    nouveauStock = actuel - toNum(saisie.slice(1), NaN);
  } else {
    nouveauStock = toNum(saisie, NaN);
  }

  if (!Number.isFinite(nouveauStock)) {
    alert("Saisie invalide.");
    return;
  }

  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveauStock })
    .eq("code_barre", code);

  if (error) {
    alert("Erreur mise à jour stock.");
    console.error(error);
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
  const code = $("new_code").value.trim();
  const nom = $("new_nom").value.trim();

  if (!code || !nom) {
    alert("Code barre et nom obligatoires.");
    return;
  }

  const { error } = await supabaseClient
    .from("produit")
    .insert([{
      code_barre: code,
      nom: nom,
      stock: toNum($("new_stock").value, 0),
      stock_min: toNum($("new_stock_min").value, 1),
      stock_max: toNum($("new_stock_max").value, 7)
    }]);

  if (error) {
    alert("Erreur ajout produit : " + error.message);
    console.error(error);
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
  const code = $("delete_code").value.trim();

  if (!code) {
    alert("Scanne ou entre un code barre à supprimer.");
    return;
  }

  const produit = produitsParCode[code];

  if (!produit) {
    alert("Produit introuvable.");
    return;
  }

  const confirmation = confirm("Supprimer le produit : " + produit.nom + " ?");
  if (!confirmation) return;

  const { error } = await supabaseClient
    .from("produit")
    .delete()
    .eq("code_barre", code);

  if (error) {
    alert("Erreur suppression produit.");
    console.error(error);
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

  const code = $("barcode_input").value.trim();
  if (!code) return;

  const produit = produitsParCode[code];

  if (!produit) {
    $("barcode_result").textContent = "Produit non trouvé : " + code;
    $("new_code").value = code;
    $("delete_code").value = code;
    $("barcode_input").value = "";
    alert("Produit non trouvé. Le code a été mis dans Ajouter produit.");
  }

// ===============================
//   TEMPS RÉEL + INIT
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