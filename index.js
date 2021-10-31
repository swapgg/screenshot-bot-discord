let Promise = require('bluebird');
let Discord = require('discord.js');
let request = require('request-promise');
let io = require('socket.io-client');

let DISCORD_TOKEN = '';

let socket = io('https://market-ws.swap.gg/');

let screenshotQueue = {};

socket.on('screenshot:ready', (data) => {
    let inspectLink = data.inspectLink;
    let imageLink = data.imageLink;

    if (screenshotQueue[inspectLink] === undefined) {
        return;
    }

    let messages = screenshotQueue[inspectLink];

    for (let message of messages) {
        message.reply(imageLink);
    }

    delete screenshotQueue[inspectLink];
});

let client = new Discord.Client();

client.on('ready', () => {
    console.log('Bot ready!');
});

client.on('message', (message) => {
    let messageContent = message.content;

    let inspectLinks = parseLink(messageContent.replace(/%20/g, ' '));

    if (inspectLinks === null) {
        return;
    }

    generateScreenshots(message, inspectLinks);
});

client.login(DISCORD_TOKEN);

function parseLink(content) {
    let matches = content.match(/^steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview [SM]\d+A\d+D\d+/mg);

    if (matches !== null) {
        return matches;
    }

    return null;
}

function generateScreenshots(message, inspectLinks) {
    let creatingScreenshot = false;
    let errorMessages = [];

    return Promise.each(inspectLinks, (inspectLink) => {
        return new Promise((resolve) => {
            return request({
                method: 'POST',
                url: 'https://market-api.swap.gg/v1/screenshot',
                json: true,
                body: {
                    inspectLink: inspectLink
                }
            }).then((data) => {
                let result = data.result;

                let inspectLink = result.inspectLink;
                let state = result.state;

                if (state === 'IN_QUEUE') {
                    if (screenshotQueue[inspectLink] === undefined) {
                        screenshotQueue[inspectLink] = [];
                    }

                    screenshotQueue[inspectLink].push(message);

                    creatingScreenshot = true;
                } else if (state === 'COMPLETED') {
                    message.reply(result.imageLink);
                }

                return resolve();
            }).catch((err) => {
                errorMessages.push(err.error.status);

                return resolve();
            });
        });
    }).then(() => {
        if (creatingScreenshot) {
            message.react('📷');
        }

        if (errorMessages.indexOf('STEAM_ERROR') > -1) {
            message.reply('an inspect link you have provided does not exist, or the CS:GO item servers are unavailable.');
        }
    });
}
