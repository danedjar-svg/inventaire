function getData() {
    fetch("Data.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur HTTP : " + response.status);
            }
            return response.text();
        })
        .then(texteCSV => {
            // Si on a déjà une sauvegarde locale, on l'utilise à la place
            try {
                const saved = localStorage.getItem("stockCSV");
                if (saved) {
                    texteCSV = saved;
                }
            } catch (e) {
                // localStorage peut être bloqué dans certains cas
            }

            // Nettoyage (au cas où)
            produitsParCode = {};

            const lignes = texteCSV.trim().split("\n");
            if (lignes.length <= 1) {
                console.warn("Le CSV ne contient aucune donnée.");
                return;
            }

            // On récupère l'en-tête (ex : codeBarre,nom,stock,stockMin,stockMax)
            const headers = lignes[0].split(",").map(h => h.trim());

            // Conteneur où on affiche le tableau
            const productDiv = document.getElementById("product");
            productDiv.innerHTML = "";

            // Tableau
            const table = document.createElement("table");
            table.border = "1";
            table.style.width = "100%";
            table.style.borderCollapse = "collapse";

            // thead
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");

            headers.forEach(header => {
                const th = document.createElement("th");
                th.textContent = header;
                th.style.padding = "6px";
                headerRow.appendChild(th);
            });

            // Colonne actions
            const thActions = document.createElement("th");
            thActions.textContent = "Actions";
            thActions.style.padding = "6px";
            headerRow.appendChild(thActions);

            thead.appendChild(headerRow);
            table.appendChild(thead);

            // tbody
            const tbody = document.createElement("tbody");
            tbody.id = "productBody";

            // Menu déroulant des produits
            const select = document.getElementById("productSelect");
            select.innerHTML = "";

            // Remplir les lignes produits
            for (let i = 1; i < lignes.length; i++) {
                const ligne = lignes[i].trim();
                if (!ligne) continue;

                const valeurs = ligne.split(",").map(v => v.trim());

                const codeBarre = valeurs[0] || "";
                const nomProduit = valeurs[1] || "";

                const tr = document.createElement("tr");
                tr.dataset.codeBarre = codeBarre;

                // cellules "données"
                valeurs.forEach((valeur, idx) => {
                    const td = document.createElement("td");
                    td.textContent = valeur;
                    td.style.padding = "6px";
                    tr.appendChild(td);
                });

                // Actions (boutons + input)
                const tdActions = document.createElement("td");
                tdActions.style.padding = "6px";

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

                const inputLigne = document.createElement("input");
                inputLigne.type = "text";
                inputLigne.size = 5;
                inputLigne.placeholder = "5, +5, -3";

                const btnOk = document.createElement("button");
                btnOk.textContent = "OK";
                btnOk.onclick = function () {
                    document.getElementById("productSelect").value = codeBarre;
                    document.getElementById("input_stock").value = inputLigne.value.trim();
                    definirStock();
                    inputLigne.value = "";
                };

                const btnSuppr = document.createElement("button");
                btnSuppr.textContent = "Supprimer";
                btnSuppr.onclick = function () {
                    if (!confirm("Supprimer ce produit ?")) return;

                    tr.remove();
                    delete produitsParCode[codeBarre];

                    // retirer du select
                    const opt = select.querySelector(`option[value="${codeBarre}"]`);
                    if (opt) opt.remove();

                    // effacer affichage si c'était sélectionné
                    if (select.value === codeBarre) {
                        document.getElementById("affichage_nom").textContent = "";
                        document.getElementById("affichage_stock").textContent = "";
                    }
                };

                tdActions.appendChild(btnPlus);
                tdActions.appendChild(btnMoins);
                tdActions.appendChild(inputLigne);
                tdActions.appendChild(btnOk);
                tdActions.appendChild(btnSuppr);

                tr.appendChild(tdActions);
                tbody.appendChild(tr);

                // Stock cell = 3e colonne (index 2) selon ton CSV : code, nom, stock, min, max
                const stockCell = tr.children[2];

                produitsParCode[codeBarre] = {
                    nom: nomProduit,
                    stockCell: stockCell, // référence à la cellule du stock
                    row: tr
                };

                // Ajout dans la liste déroulante
                const option = document.createElement("option");
                option.value = codeBarre;
                option.textContent = `${codeBarre} - ${nomProduit}`;
                select.appendChild(option);

                // Couleur initiale
                mettreAJourEtatLigne(codeBarre, produitsParCode[codeBarre], null, false); // pas d'animation au chargement
            }

            table.appendChild(tbody);
            productDiv.appendChild(table);

            // --- Recherche instantanée (filtre en direct) ---
            const searchInput = document.getElementById("searchInput");
            if (searchInput) {
                searchInput.oninput = filtrerProduits;
                // si un texte est déjà saisi, on applique le filtre
                filtrerProduits();
            }
        })
        .catch(error => {
            console.error("Erreur lors du chargement du CSV :", error); // Afficher l'erreur dans la console
            alert("Erreur lors du chargement du CSV : " + error.message); // Alerter l'utilisateur
        });
}
