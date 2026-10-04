const { chromium } = require("playwright");
const fs = require("fs");

const PAGE_URL =
    "https://www.vnf.fr/aghyre/#!/rsi-site/tab-rru-non-masquee/id:::L16956?c=0";

const API_PART =
    "/api/rsi-data/data";

async function main() {

    console.log("Ouverture de aGHyre...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    try {

        /*
         * On attend la requête API L16956.
         * Playwright laisse le navigateur aGHyre
         * récupérer lui-même son authentification.
         */

        const responsePromise = page.waitForResponse(
            response => {

                const url = response.url();

                return (
                    url.includes(API_PART) &&
                    url.includes("pks=id:::L16956")
                );

            },
            {
                timeout: 60000
            }
        );

        console.log("Chargement de la page...");

        await page.goto(PAGE_URL, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        console.log("Page chargée.");

        /*
         * Attente de la réponse API
         */

        const response = await responsePromise;

        console.log(
            "Réponse VNF trouvée :",
            response.url()
        );

        if (!response.ok()) {

            throw new Error(
                "API VNF HTTP " +
                response.status()
            );

        }

        const data = await response.json();

        console.log(
            "Nombre de relevés :",
            data.values?.length
        );

        if (
            !data.values ||
            data.values.length === 0
        ) {

            throw new Error(
                "La réponse VNF ne contient aucun relevé."
            );

        }

        /*
         * Le premier élément est le relevé le plus récent.
         *
         * values[0] = première rubrique
         * values[1] = niveau
         */

        const releve = data.values[0];

        if (
            !releve.values ||
            releve.values.length < 2
        ) {

            throw new Error(
                "Structure inattendue des données VNF."
            );

        }

        const niveau =
            releve.values[1].value;

        const date =
            new Date(releve.date);

        console.log(
            "Date du relevé :",
            date.toISOString()
        );

        console.log(
            "Niveau :",
            niveau
        );

        /*
         * Création de niveau.json
         */

        const resultat = {

            date: date.toLocaleString(
                "fr-FR",
                {
                    timeZone: "Europe/Paris",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            ),

            niveau: Number(niveau)

        };

        fs.writeFileSync(
            "niveau.json",
            JSON.stringify(
                resultat,
                null,
                2
            ) + "\n"
        );

        console.log(
            "niveau.json créé :",
            resultat
        );

    } finally {

        await browser.close();

    }
}

main().catch(error => {

    console.error(error);

    process.exit(1);

});
