const { chromium } = require("playwright");
const fs = require("fs");

const URL =
    "https://www.vnf.fr/aghyre/#!/rsi-site/tab-rru-non-masquee/id:::L16956?c=0";

async function main() {

    console.log("Ouverture de aGHyre...");

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    let resultat = null;

    page.on("response", async (response) => {

        const url = response.url();

        if (!url.includes("/api/rsi-data/data")) {
            return;
        }

        try {

            const data = await response.json();

            if (
                data.values &&
                data.values.length > 0 &&
                data.values[0].values &&
                data.values[0].values.length >= 2
            ) {

                const releve = data.values[0];

                const niveau =
                    releve.values[1].value;

                resultat = {
                    date: new Date(
                        releve.date
                    ).toLocaleString(
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
                    niveau: niveau
                };

                console.log(
                    "Niveau trouvé :",
                    niveau
                );
            }

        } catch (error) {

            console.log(
                "Réponse ignorée :",
                error.message
            );
        }
    });

    await page.goto(URL, {
        waitUntil: "networkidle",
        timeout: 60000
    });

    console.log("Page chargée.");

    // Laisse le temps à aGHyre de faire ses appels API
    await page.waitForTimeout(10000);

    await browser.close();

    if (!resultat) {

        throw new Error(
            "Aucun relevé VNF trouvé."
        );
    }

    fs.writeFileSync(
        "niveau.json",
        JSON.stringify(
            resultat,
            null,
            2
        )
    );

    console.log(
        "niveau.json mis à jour."
    );

    console.log(resultat);
}

main().catch(error => {

    console.error(error);

    process.exit(1);

});
