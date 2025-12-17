// =========================================================
//   ETAT GLOBAL
// =========================================================

// Dictionnaire produits indexé par code-barres
// produitsParCode[code] = { nom, row, stockCell }
let produitsParCode = {};

// Petit helper pour getElementById
function $(id) { return document.getElementById(id); }

// =========================================================
//   LOGIN / LOGOUT
// =========================================================

function login() {
  const u = ($("login_username").value || "").trim();
  const p = ($("login_password").value || "").trim();

  // Login simple "en dur" (pour l'instant)
  if (u === "admin" && p === "1234") {
    $("login_error").textContent = "";

    // On masque le login et on affiche l'inventaire
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";

    // On charge les données CSV
    getData();
  } else {
    $("login_error").textContent = "Identifiants incorrects. Veuillez réessayer.";
  }
}

function logout() {
  $("login_username").value = "";
  $("login_password").value = "";
  $("login_error").textContent = "";

  // On masque l'inventaire et on ré-affiche le login
  $("inventory_section").style.display = "none";
  $("login_section").style.display = "block";

  // Reset affichage sélection
  $("affichage_nom").textContent = "";
  $("affichage_stock").textContent = "0";
  $("input_stock").value = "";
}

// =========================================================
//   CHARGEMENT CSV + CONSTRUCTION TABLE
// =========================================================

function getData() {
  fetch("Data.csv")
    .then(r => {
      if (!r.ok) throw new Error("Erreur HTTP : " + r.status);
      return r.text();
    })
    .then(csvText => {
      // Si l'utilisateur avait sauvegardé dans le navigateur,
      // on prend cette version à la place du fichier.
      try {
        const saved = localStorage.getItem("stockCSV");
        if (saved) csvText = saved;
      } catch (e) {}

      // Reset
      produitsParCode = {};

      // Découpe du CSV
      const lignes = csvText.trim().split("\n").filter(l => l.trim() !== "");
      if (lignes.length < 2) {
        console.warn("CSV vide ou invalide");
        renderTableVide();
        return;
      }

      // Headers (ligne 0)
      const headers = lignes[0].split(",").map(h => h.trim());

      // Reset UI table
      const productDiv = $("product");
      productDiv.innerHTML = "";

      // Création table
      const table = document.createElement("table");
      table.border = "1";
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";

      // thead
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");

      headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.padding = "6px";
        trh.appendChild(th);
      });

      const thA = document.createElement("th");
      thA.textContent = "Actions";
      thA.style.padding = "6px";
      trh.appendChild(thA);

      thead.appendChild(trh);
      table.appendChild(thead);

      // tbody
      const tbody = document.createElement("tbody");
      tbody.id = "productBody";

      // Reset select (garder l'option placeholder)
      const select = $("productSelect");
      select.innerHTML = `<option value="">-- Sélectionnez un produit --</option>`;

      // Parcours des lignes data
      for (let i = 1; i < lignes.length; i++) {
        const vals = lignes[i].split(",").map(v => v.trim());

        const codeBarre = vals[0] || "";
        const nomProduit = vals[1] || "";

        if (!codeBarre) continue;

        const tr = document.createElement("tr");
        tr.dataset.codeBarre = codeBarre;

        // Création des cellules CSV (code, nom, stock, min, max)
        vals.forEach(v => {
          const td = document.createElement("td");
          td.textContent = v;
          td.style.padding = "6px";
          tr.appendChild(td);
        });

        // Création cellule actions
        const tdActions = document.createElement("td");
        tdActions.style.padding = "6px";

        // Bouton +
        const btnPlus = document.createElement("button");
        btnPlus.type = "button";
        btnPlus.textContent = "+";
        btnPlus.onclick = () => {
          select.value = codeBarre;
          afficherProduit();
          stock();
        };

        // Bouton -
        const btnMoins = document.createElement("button");
        btnMoins.type = "button";
        btnMoins.textContent = "-";
        btnMoins.onclick = () => {
          select.value = codeBarre;
          afficherProduit();
          retrait();
        };

        // Input rapide ligne
        const inputLigne = document.createElement("input");
        inputLigne.type = "text";
        inputLigne.size = 6;
        inputLigne.placeholder = "5, +5";
        inputLigne.style.margin = "0 6px";

        // OK ligne => applique definirStock()
        const btnOK = document.createElement("button");
        btnOK.type = "button";
        btnOK.textContent = "OK";
        btnOK.onclick = () => {
          select.value = codeBarre;
          afficherProduit();
          $("input_stock").value = (inputLigne.value || "").trim();
          definirStock();
          inputLigne.value = "";
        };

        // Enter sur input ligne => OK
        inputLigne.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            btnOK.click();
          }
        });

        // Supprimer
        const btnSuppr = document.createElement("button");
        btnSuppr.type = "button";
        btnSuppr.textContent = "Supprimer";
        btnSuppr.style.marginLeft = "6px";
        btnSuppr.onclick = () => {
          if (!confirm("Supprimer ce produit ?")) return;

          tr.remove();
          delete produitsParCode[codeBarre];

          const opt = select.querySelector(`option[value="${codeBarre}"]`);
          if (opt) opt.remove();

          if (select.value === codeBarre) {
            select.value = "";
            $("affichage_nom").textContent = "";
            $("affichage_stock").textContent = "0";
          }

          filtrerProduits();
        };

        // Montage actions
        tdActions.appendChild(btnPlus);
        tdActions.appendChild(btnMoins);
        tdActions.appendChild(inputLigne);
        tdActions.appendChild(btnOK);
        tdActions.appendChild(btnSuppr);

        tr.appendChild(tdActions);

        // Stock cell = colonne index 2
        const stockCell = tr.children[2];

        // Enregistrement dans le dictionnaire
        produitsParCode[codeBarre] = {
          nom: nomProduit,
          row: tr,
          stockCell: stockCell
        };

        // Ajout option dans le select
        const option = document.createElement("option");
        option.value = codeBarre;
        option.textContent = `${codeBarre} - ${nomProduit}`;
        select.appendChild(option);

        // Mise à jour état / couleur inline
        mettreAJourEtatLigne(codeBarre);

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      productDiv.appendChild(table);

      // Afficher le premier produit si existant
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        afficherProduit();
      } else {
        select.value = "";
        $("affichage_nom").textContent = "";
        $("affichage_stock").textContent = "0";
      }

      // Recherche instantanée
      const searchInput = $("searchInput");
      if (searchInput) {
        searchInput.oninput = filtrerProduits;
        filtrerProduits();
      }
    })
    .catch(err => console.error("Erreur chargement CSV :", err));
}

function renderTableVide() {
  const productDiv = $("product");
  if (productDiv) productDiv.textContent = "Aucun produit dans le CSV.";
}

// =========================================================
//   AFFICHAGE PRODUIT SELECTIONNE
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
  $("affichage_stock").textContent = (p.stockCell.textContent || "0");
}

// =========================================================
//   ALERTES SEUILS (NEGATIF / MIN / MAX)
// =========================================================
//
// Objectif : ne pas spammer.
// On alerte seulement au moment où on "franchit" un seuil.
//
// Exemple :
// - si tu es déjà en dessous du min et que tu diminues encore,
//   on ne ré-affiche pas
// - si tu es au-dessus du min et que tu diminues en dessous, 