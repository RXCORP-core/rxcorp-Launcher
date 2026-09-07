/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const path = require('path');
let pkg;
try {
    pkg = require('../../../../package.json');
} catch {
    try {
        pkg = require('../package.json');
    } catch {
        pkg = require(path.resolve('./package.json'));
    }
}
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/config`;
let articles = `${url}/articles`;

const defaultDeltaZoneConfig = {
    maintenance: false,
    maintenance_message: "Le serveur DeltaZone est actuellement en maintenance.",
    dataDirectory: "DeltaZone",
    online: false,
    client_id: "13f589e1-e2fc-443e-a68a-63b0092b8eeb",
    socialLinks: []
};

const defaultDeltaZoneInstances = [
    {
        name: "DeltaZone Apocalypse",
        url: null,
        loader: {
            minecraft_version: "1.20.1",
            loader_type: "forge",
            loader_version: "latest",
            mcp_file: null
        },
        verify: false,
        ignored: [],
        whitelist: [],
        whitelistActive: false,
        status: {
            nameServer: "DELTAZONE",
            ip: "play.deltazone.fr",
            port: null
        }
    }
];

const defaultDeltaZoneNews = [
    {
        title: "☣ ALERTE MAXIMALE // ZONE INFECTÉE",
        content: "L'épidémie s'est propagée dans tous les secteurs. Rejoignez le complexe de sécurité DeltaZone et faites le plein d'armes et de munitions avant la nuit.",
        author: "QG DeltaZone",
        publish_date: new Date().toISOString()
    },
    {
        title: "📦 PARACHUTAGE DE RAVITAILLEMENT",
        content: "Des vivres, filtres à radiations et kits médicaux sont largués régulièrement en zone rouge. Restez groupés pour survivre.",
        author: "Section Ravitaillement",
        publish_date: new Date().toISOString()
    }
];

class Config {
    GetConfig() {
        return new Promise((resolve) => {
            nodeFetch(config, { timeout: 4000 }).then(async res => {
                if (res.status === 200) {
                    let json = await res.json();
                    json.dataDirectory = "DeltaZone";
                    return resolve(json);
                }
                return resolve(defaultDeltaZoneConfig);
            }).catch(() => {
                return resolve(defaultDeltaZoneConfig);
            });
        });
    }

    async getInstanceList() {
        let urlInstance = `${url}/instances`;
        try {
            let instances = await nodeFetch(urlInstance, { timeout: 3000 }).then(res => res.json()).catch(() => null);
            let instancesList = [];
            if (instances && Object.keys(instances).length > 0) {
                for (let [name, data] of Object.entries(instances)) {
                    instancesList.push(data);
                }
            }
            let hasDeltaZone = instancesList.some(i => i.name && i.name.toLowerCase().includes('deltazone'));
            if (!hasDeltaZone) {
                instancesList.unshift(defaultDeltaZoneInstances[0]);
            }
            return instancesList;
        } catch {
            return defaultDeltaZoneInstances;
        }
    }

    async getNews(config) {
        if (config && config.rss) {
            return new Promise((resolve) => {
                nodeFetch(config.rss, { timeout: 4000 }).then(async res => {
                    if (res.status === 200) {
                        let news = [];
                        let response = await res.text();
                        response = (JSON.parse(convert.xml2json(response, { compact: true })))?.rss?.channel?.item;

                        if (!Array.isArray(response)) response = [response];
                        for (let item of response) {
                            news.push({
                                title: item.title._text,
                                content: item['content:encoded']._text,
                                author: item['dc:creator']._text,
                                publish_date: item.pubDate._text
                            });
                        }
                        return resolve(news);
                    }
                    return resolve(defaultDeltaZoneNews);
                }).catch(() => resolve(defaultDeltaZoneNews));
            });
        } else {
            return new Promise((resolve) => {
                nodeFetch(articles, { timeout: 4000 }).then(async res => {
                    if (res.status === 200) return resolve(res.json());
                    return resolve(defaultDeltaZoneNews);
                }).catch(() => resolve(defaultDeltaZoneNews));
            });
        }
    }
}

export default new Config;