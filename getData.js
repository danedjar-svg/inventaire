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
  const u = $("login_username").value.trim();
  const p = $("login_password").value.trim();

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
//   CHARGEMENT CSV
// =========================================================

function getData() {
  fetch("Data.csv")
    .then(r => r.text())
    .then(csv => {
      produitsParCode = {};

      const lignes = csv.trim().split("\n");
      const headers = lignes[0].split(",");

      const productDiv = $("product");
      productDiv.innerHTML = "";

      const table = document.createElement("table");
      table.border = "1";
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";

      const thead = document.createElement("thead");
      const trh = document.createElement("tr");

      headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        trh.appendChild(th);
      });

      const thAction = document.createElement("th");
      thAction.textContent = "Actions";
      trh.appendChild(thAction);

      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      tbody.id = "productBody";

      const select = $("productSelect");
      select.innerHTML = `<option value="">-- Sélectionnez un produit --</option>`;

      for (let i = 1; i < lignes.length; i++) {
        const vals = lignes[i].split(",");
        const code = vals[0].trim();
        const nom = vals[1].trim();

        const tr = document.createElement("tr");

        vals.forEach(v => {
          const td = document.createElement("td");
          td.textContent = v.trim();
          tr.appendChild(td);
        });

        const tdAction = document.createElement("td");

        const btnPlus = document.createElement("button");
        btnPlus.textContent = "+";
        btnPlus.onclick = () => {
          select.value = code;
          afficherProduit();
          stock();
        };

        const btnMoins = document.createElement("button");
        btnMoins.textContent = "-";
        btnMoins.onclick = () => {
          select.value = code;
          afficherProduit();
          retrait();
        };

        tdAction.appendChild(btnPlus);
        tdAction.appendChild(btnMoins);
        tr.appendChild(tdAction);

        tbody.appendChild(tr);

        produitsParCode[code] = {
          nom: nom,
          row: tr,
          stockCell: tr.children[2]
        };

        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = `${code} - ${nom}`;
        select.appendChild(opt);
      }

      table.appendChild(tbody);
      productDiv.appendChild(table);
    })
    .catch(err => console.error(err));
}

// =========================================================
//   AFFICHAGE PRODUIT
// =========================================================

function afficherProduit() {
  const code = $("productSelect").value;
  const p = produitsParCode[code];

  if (!p) {
    $("affichage_nom").textContent = "";
    $("affichage_stock").textContent = "0";
    return;
  }

  $("affichage_nom").textContent = p.nom;
  $("affichage_stock").textContent = p.stockCell.textContent;
}

// =========================================================
//   GESTION DU STOCK
// =========================================================

function definirStock() {
  const code = $("productSelect").value;
  const val = $("input_stock").value.trim();
  if (!code || !val) return;

  const current = parseInt(produitsParCode[code].stockCell.textContent, 10);

  let newVal;
  if (/^[+-]\d+$/.test(val)) {
    newVal = current + parseInt(val, 10);
  } else if (/^\d+$/.test(val)) {
    newVal = parseInt(val, 10);
  } else {
    alert("Format invalide");
    return;
  }

  produitsParCode[code].stockCell.textContent = newVal;
  $("affichage_stock").textContent = newVal;
  $("input_stock").value = "";
}

function stock() {
  const code = $("productSelect").value;
  if (!code) return;
  definirStockValue(code, +1);
}

function retrait() {
  const code = $("productSelect").value;
  if (!code) return;
  definirStockValue(code, -1);
}

function definirStockValue(code, delta) {
  const p = produitsParCode[code];
  const val = parseInt(p.stockCell.textContent, 10) + delta;
  p.stockCell.textContent = val;
  $("affichage_stock").textContent = val;
}

// =========================================================
//   RECHERCHE
// =========================================================

function filtrerProduits() {
  const q = $("searchInput").value.toLowerCase();
  const rows = document.querySelectorAll("#productBody tr");

  rows.forEach(r => {
    const code = r.children[0].textContent.toLowerCase();
    const nom = r.children[1].textContent.toLowerCase();
    r.style.display = (code.includes(q) || nom.includes(q)) ? "" : "none";
  });
}

function effacerRecherche() {
  $("searchInput").value = "";
  filtrerProduits();
}
