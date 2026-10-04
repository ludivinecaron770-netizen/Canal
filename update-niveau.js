const { chromium } = require("playwright");
const fs = require("fs");

const PAGE_URL =
    "https://www.vnf.fr/aghyre/#!/rsi-site/tab-rru-non-masquee/id:::L16956?c=0";

const API_URL =
    "https://www.vnf.fr/aghyre/api/rsi-data/data" +
    "?dateReference=" + encodeURIComponent(new Date().toISOString()) +
    "&limit=20" +
    "&pas=86400" +
    "&pks=id:::L16956" +
    "&rubricMasc=true";

async function main() {

    console.log("Ouverture de aGHyre...");

    const browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext();

    const page = await context.newPage();

    let bearer = null;

    /*
     * On surveille toutes les requêtes du navigateur.
     * Dès qu'une requête a un Authorization Bearer,
     * on récupère le token.
     */

    page.on("request", request => {

        const authorization =
            request.headers()["authorization"];

        if (
            authorization &&
            authorization.startsWith("Bearer ")
        ) {

            bearer = authorization.substring(7);

            console.log(
                "Token anonyme VNF détecté."
            );
        }
    });

    try {

        await page.goto(PAGE_URL, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        console.log("Page chargée.");

        /*
         * Laisse aGHyre initialiser son authentification.
         */

        await page.waitForTimeout(15000);

        if (!bearer) {

            throw new Error(
                "Impossible de récupérer le token anonyme VNF."
            );
        }

        console.log(
            "Appel direct de l'API VNF..."
        );

        /*
         * On utilise le même navigateur pour faire
         * l'appel API avec le Bearer récupéré.
         */

        const result = await page.evaluate(
            async ({ apiUrl, token }) => {

                const response = await fetch(
                    apiUrl,
                    {
                        headers: {
                            "Accept":
                                "application/json",

                            "Authorization":
                                "Bearer " + token
                        }
                    }
                );

                return {
                    status: response.status,
                    data: await response.json()
                };
            },
            {
                apiUrl: API_URL,
                token: bearer
            }
        );

        console.log(
            "HTTP API :",
            result.status
        );

        if (result.status !== 200) {

            throw new Error(
                "API VNF HTTP " +
                result.status
            );
        }

        const data = result.data;

        if (
            !data.values ||
            data.values.length === 0
        ) {

            throw new Error(
                "Aucun relevé trouvé."
            );
        }

        const releve = data.values[0];

        if (
            !releve.values ||
            releve.values.length < 2
        ) {

            throw new Error(
                "Structure des données inattendue."
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
            "niveau.json mis à jour."
        );

    } finally {

        await browser.close();
    }
}

main().catch(error => {

    console.error(error);

    process.exit(1);

});
