// ===============================
//   VARIABLES GLOBALES
// ===============================

let produitsParCode = {}; 

// ===============================
//   FONCTION : login()
// ===============================
function login() {
    const username = document.getElementById("login_username").value;
    const password = document.getElementById("login_password").value;

    if (username === "admin" && password === "1234") {
        document.getElementById("login_section").style.display = "none";
        document.getElementById("inventory_section").style.display = "block"; 
        document.getElementById("login_error").style.display = "none";
        getData();
    } else {  
        document.getElementById("login_error").style.display = "block";
    }
} 

// ===============================
//   FONCTION : logout()
// ===============================
function logout() {
    document.getElementById("login_section").style.display = "block";
    document.getElementById("inventory_section").style.display = "none"; 

    document.getElementById("login_username").value = "";
    document.getElementById("login_password").value = "";
    document.getElementById("login_error").style.display = "none";

    document.getElementById("affichage_stock").textContent = "stock : 0";

    const select = document.getElementById("productSelect");
    if (select) {
        select.innerHTML = "<option value=\"\">-- Sélectionnez un produit --</option>";
    }

    document.getElementById("product").innerHTML = "";
    produitsParCode = {};
}

// ===============================
//   FONCTION : getData()
// ===============================
function getData() {

    fetch("Data.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur HTTP : " + response.status);
            }
            return response.text();
        })
        .then(texteCSV => {

            produitsParCode = {};

            const select = document.getElementById("productSelect");
            select.innerHTML = "";

            const optDefault = document.createElement("option");
            optDefault.value = "";
            optDefault.textContent = "-- Sélectionnez un produit --";
            select.appendChild(optDefault);

            const lignes = texteCSV.trim().split("\n");
            const entetes = lignes[0].split(",");

            const productDiv = document.getElementById("product");
            productDiv.innerHTML = "";

            const table = document.createElement("table");
            const thead = document.createElement("thead");
            const tbody = document.createElement("tbody");

            const trHead = document.createElement("tr");

            entetes.forEach(titre => {
                const th = document.createElement("th");
                th.textContent = titre;
                trHead.appendChild(th);
            });

            // *** AJOUT : COLONNE ACTIONS ***
            const thActions = document.createElement("th");
            thActions.textContent = "Actions";
            trHead.appendChild(thActions);
            // ********************************

            thead.appendChild(trHead);
            table.appendChild(thead);

            for (let i = 1; i < lignes.length; i++) {

                const ligneBrute = lignes[i].trim();
                if (ligneBrute === "") continue;

                const valeurs = ligneBrute.split(",");
                const codeBarre = valeurs[0];
                const nomProduit = valeurs[1];

                const tr = document.createElement("tr");
                tr.dataset.codeBarre = codeBarre;

                valeurs.forEach((valeur, index) => {
                    const td = document.createElement("td");
                    td.textContent = valeur;

                    if (index === 2) {
                        td.classList.add("stockCell");
                    }

                    tr.appendChild(td);
                });

                // *** AJOUT : BOUTONS + et - ***
                const tdActions = document.createElement("td");

                const btnPlus = document.createElement("button");
                btnPlus.textContent = "+";
                btnPlus.onclick = function () {
                    document.getElementById("productSelect").value = codeBarre;
                    stock();
                };

                const btnMoins = document.createElement("button");
                btnMoins.textContent = "-";
                btnMoins.onclick = function () {
                    document.getElementById("productSelect").value = codeBarre;
                    retrait();
                };

                tdActions.appendChild(btnPlus);
                tdActions.appendChild(btnMoins);
                tr.appendChild(tdActions);
                // ********************************

                tbody.appendChild(tr);

                const stockCell = tr.querySelector(".stockCell");

                produitsParCode[codeBarre] = {
                    nom: nomProduit,
                    stockCell: stockCell,
                    row: tr
                };

                const opt = document.createElement("option");
                opt.value = codeBarre;
                opt.textContent = nomProduit;
                select.appendChild(opt);
            }

            table.appendChild(tbody);
            productDiv.appendChild(table);

            select.onchange = function () {
                const code = this.value;
                const info = produitsParCode[code];

                Object.values(produitsParCode).forEach(p => {
                    p.row.style.backgroundColor = "";
                });

                if (!code || !info) {
                    document.getElementById("affichage_stock").textContent = "stock : 0";
                    return;
                }

                info.row.style.backgroundColor = "#d0f0ff";

                const stockActuel = parseInt(info.stockCell.textContent) || 0;
                document.getElementById("affichage_stock").textContent =
                    "stock : " + stockActuel;
            };
        })
        .catch(error => {
            console.error("Erreur lors du chargement du CSV :", error);
        });
}

// ===============================
//   FONCTION : stock()
// ===============================
function stock() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    let stockActuel = parseInt(info.stockCell.textContent) || 0;
    stockActuel++;
    info.stockCell.textContent = stockActuel;

    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;
}

// ===============================
//   FONCTION : retrait()
// ===============================
function retrait() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    let stockActuel = parseInt(info.stockCell.textContent) || 0;
    stockActuel--;
    if (stockActuel < 0) stockActuel = 0;

    info.stockCell.textContent = stockActuel;
    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;
}

// ===============================
//   FONCTION : definirStock()
// ===============================
function definirStock() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    const saisie = document.getElementById("input_stock").value.trim();
    if (saisie === "") {
        alert("Veuillez entrer un nombre (ex : 5, +5, -5).");
        return;
    }

    let stockActuel = parseInt(info.stockCell.textContent) || 0;
    let nouveau_stock;

    if (saisie[0] === "+") {
        const nombre = parseInt(saisie.substring(1));
        if (isNaN(nombre)) { alert("Saisie invalide."); return; }
        nouveau_stock = stockActuel + nombre;

    } else if (saisie[0] === "-") {
        const nombre = parseInt(saisie.substring(1));
        if (isNaN(nombre)) { alert("Saisie invalide."); return; }
        nouveau_stock = stockActuel - nombre;

    } else {
        const nombre = parseInt(saisie);
        if (isNaN(nombre)) { alert("Saisie invalide."); return; }
        nouveau_stock = nombre;
    }

    if (nouveau_stock < 0) nouveau_stock = 0;

    info.stockCell.textContent = nouveau_stock;
    document.getElementById("affichage_stock").textContent = "stock : " + nouveau_stock;
    document.getElementById("input_stock").value = "";
}
