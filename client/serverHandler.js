var msgpack = window.msgpack;
var config = window.config;

var lastUpdate = window.performance.now();

window.actionBarSlots = [];
window.inventorySlots = [];
window.holdingSelectorIndex = 0;
window.damageTexts = [];

function Structure(infoID, infoType, infoX, infoY, infoDir, infoOwner) {
	this.infoID = infoID;
	this.infoType = infoType;
	this.infoX = infoX;
	this.infoY = infoY;
	this.infoDir = infoDir;
	this.infoOwner = infoOwner;
	this.infoCraftTime = undefined;
	this.infoCraftStart = undefined;
}

function DamageText(infoX, infoY, infoDmg, infoType) {
    this.infoX = infoX;
    this.infoY = infoY;
    this.infoDmg = infoDmg;
    this.infoType = infoType;
    this.infoStart = Date.now();
	
	let found = false;
	for (let j = 0; j < window.damageTexts.length; j++) {
		if (typeof window.damageTexts[j] == 'undefined') {
			window.damageTexts[j] = this;
			found = true;
		}
	}
	if (!found) {
		window.damageTexts.push(this);
	}
}

function CircularArray(capacity) {
	this.arrayBuffer = Array(capacity).fill(undefined);
	this.length = 0;
	this.readPointer = 0;
	this.writePointer = 0;
	this.capacity = capacity;
}
CircularArray.prototype.peek = function() {
	if (this.length > 0) {
		return this.arrayBuffer[this.readPointer];
	}
	return undefined;
}
CircularArray.prototype.peekN = function(n) {
	if ((this.length > 0) && (n < this.length)) {
		return this.arrayBuffer[(this.readPointer + n) % this.capacity];
	}
	return undefined;
}
CircularArray.prototype.getWriteElement = function() {
	return this.arrayBuffer[this.writePointer];
}
CircularArray.prototype.advanceWritePointer = function() {
	this.writePointer = (this.writePointer + 1) % this.capacity;
	this.length += 1;
	while (this.length > this.capacity) {
		this.next();
	}
}
CircularArray.prototype.add = function(inputElement) {
	this.arrayBuffer[this.writePointer] = inputElement;
	this.advanceWritePointer();
}
CircularArray.prototype.next = function() {
	if (this.length > 0) {
		let toReturn = this.arrayBuffer[this.readPointer];
		this.length -= 1;
		this.readPointer = (this.readPointer + 1) % this.capacity;
		return toReturn;
	}
	return undefined;
}

function Player(infoID, infoX, infoY, infodir, infoholding, infohealth, infoTime) {
	this.infoID = infoID;
	this.infodir = infodir;
	this.infoholding = infoholding;
	this.infohealth = infohealth;
	this.infoLoc = new CircularArray(20);
	
	this.projectedLoc = [infoX, infoY];
	this.deltas = [0, 0];
	this.oldProjectedLoc = [infoX, infoY];
	
    this.deltaT = config.TICK_INTERVAL;
	this.lastTickTime = infoTime;
}
Player.prototype.getProjectedLoc = function(infoTime) {
	let targetTime = infoTime - window.jitterSmooth;
	
	if (this.infoLoc.length > 0) {
		while (
			(typeof this.infoLoc.peekN(1) != 'undefined') && 
			(targetTime >= this.infoLoc.peekN(1)[2])
		) {
			this.infoLoc.next();
		}
		
		if (
			(typeof this.infoLoc.peek() != 'undefined') && 
			(targetTime >= this.infoLoc.peek()[2])
		) {
			window.updateStructureCanvas = true;
			
			let extractedUpdate = this.infoLoc.next();
            this.olderTickTime = this.lastTickTime;
			this.lastTickTime = extractedUpdate[2];
			
			this.oldProjectedLoc[0] = this.projectedLoc[0];
			this.oldProjectedLoc[1] = this.projectedLoc[1];
			
			this.deltas[0] = extractedUpdate[0] - this.oldProjectedLoc[0];
			this.deltas[1] = extractedUpdate[1] - this.oldProjectedLoc[1];

			//this.deltaT = this.lastTickTime - this.olderTickTime;
			this.deltaT = config.TICK_INTERVAL;
		}
	}
	
	this.projectedLoc[0] = this.oldProjectedLoc[0] + (this.deltas[0] * (targetTime - this.lastTickTime) / this.deltaT);
	this.projectedLoc[1] = this.oldProjectedLoc[1] + (this.deltas[1] * (targetTime - this.lastTickTime) / this.deltaT);
	
	return this.projectedLoc;
}
Player.prototype.setLoc = function(infoX, infoY, infoTime) {
    let actualTime = undefined;
    if (this.infoLoc.length > 0) {
        actualTime = this.infoLoc.peekN(this.infoLoc.length-1)[2] + config.TICK_INTERVAL;
    }
    else {
        actualTime = this.lastTickTime + config.TICK_INTERVAL;
    }

    if (actualTime - infoTime > window.jitterSmooth) {
        actualTime = infoTime + window.jitterSmooth;
        this.lastTickTime = actualTime - config.TICK_INTERVAL;
    }
    else if (infoTime - actualTime > window.jitterSmooth) {
        actualTime = infoTime - window.jitterSmooth;
        this.lastTickTime = actualTime - config.TICK_INTERVAL;
    }

	let writeElement = this.infoLoc.getWriteElement();
	if (typeof writeElement != 'undefined') {
		writeElement[0] = infoX;
		writeElement[1] = infoY;
		writeElement[2] = actualTime;
		this.infoLoc.advanceWritePointer();
	}
	else {
		this.infoLoc.add([infoX, infoY, actualTime]);
	}
}

window.mainHandler = function(e) {
    let data = new Uint8Array(e.data);
    if (data.length != 0) {
        recieved.data = data;
        recieved.start = 1;
        if (data[0] == msgpack.PLAYER_UPDATE_DELIM) {
			let currTime = window.performance.now();

            lastUpdate = currTime;
			
            let newVisiblePlayers = [];
			
            let infoID = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infodir = msgpack.expectNumb(recieved);
            let infoholding = msgpack.expectNumb(recieved);
            let infohealth = msgpack.expectNumb(recieved);
            let infohitting = msgpack.expectHit(recieved);
            while (infoID !== undefined) {
				let toModify = window.players[infoID];
				if (
					(typeof window.players[infoID] == 'undefined') || 
					(
						(!window.visiblePlayers.includes(infoID)) &&
						(window.playerID != infoID)
					)
				) {
					window.players[infoID] = new Player(infoID, infoX, infoY, infodir, infoholding, infohealth, lastUpdate);
					toModify = window.players[infoID];
				}
				else {
					toModify.setLoc(infoX, infoY, lastUpdate);
					toModify.infodir = infodir;
				}
				
				if (infohealth != toModify.infohealth) {
					let textType = undefined;
					let isSelf = (infoID == window.playerID);
					let isTeammate = (typeof window.playerAllegiances[window.playerID] != 'undefined') && (window.playerAllegiances[window.playerID] == window.playerAllegiances[infoID]);
					
					if (isSelf) {
						textType = (infohealth < toModify.infohealth) ? "focusbad" : "good";
					}
					else if (isTeammate) {
						textType = (infohealth < toModify.infohealth) ? "bad" : undefined;
					}
					else {
						textType = (infohealth < toModify.infohealth) ? "neutral" : undefined;
					}
					
					if (typeof textType != 'undefined') {
						let insertedDamageText = new DamageText(infoX + 2 * config.PLAYER_RADIUS * Math.random(), infoY + config.PLAYER_RADIUS, Math.abs(toModify.infohealth - infohealth), textType);
					}
				}
				toModify.infohealth = infohealth;
				
				if (infohitting == true) {
					window.hitTimes[infoID] = currTime;
					let hitID = msgpack.expectNumb(recieved);
					while (hitID !== undefined) {
						window.hitObjects[hitID] = currTime;
						hitID = msgpack.expectNumb(recieved);
					}
					let hitClose = msgpack.expectHit(recieved);
				}
				
                if (infoID == playerID) {
                    let willUpdateHUD = false;
					
                    if (infoholding != toModify.infoholding) {
                        toModify.infoholding = infoholding;
                        willUpdateHUD = true;
                    }
					
                    let infoSelectorIndex = msgpack.expectNumb(recieved);
                    if (window.holdingSelectorIndex != infoSelectorIndex) {
                        window.holdingSelectorIndex = infoSelectorIndex;
                        willUpdateHUD = true;
                    }
					if (willUpdateHUD == true) {
                        window.updateStrucDiv();
                    }
                }
                else {
                    newVisiblePlayers.push(infoID);
					
					toModify.infoholding = infoholding;
					let throwAway = msgpack.expectNumb(recieved);
                }
                infoID = msgpack.expectNumb(recieved);
                infoX = msgpack.expectNumb(recieved);
                infoY = msgpack.expectNumb(recieved);
                infodir = msgpack.expectNumb(recieved);
                infoholding = msgpack.expectNumb(recieved);
                infohealth = msgpack.expectNumb(recieved);
                infohitting = msgpack.expectHit(recieved);
            }

            window.visiblePlayers = newVisiblePlayers;

            if ((window.frameFullOcclude == true) && (window.oldFrameOcclude == false)) {
                window.oldFrameOcclude = true;
                window.occludeSwitchTime = currTime;
                window.occludeCutoffCounter = 0;
            }
            if (window.frameFullOcclude == false) {
                window.occludeCutoffCounter += 1;
                if (window.occludeCutoffCounter >= 3) {
                    window.occludeSwitchTime = undefined;
                    window.occludeCutoffCounter = 0;
                    window.oldFrameOcclude = false;
                }
            }
            window.frameFullOcclude = false;
        }
        else if (data[0] == msgpack.PLAYER_DESTROY_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            if ((window.players[infoID] !== undefined) && (window.visiblePlayers.includes(infoID))) {
                //window.playerNames[infoID] = undefined;
				let projectedLoc = window.players[infoID].getProjectedLoc();
				if ((typeof projectedLoc == 'undefined') || (!projectedLoc[0]) || (!projectedLoc[1])) {
					projectedLoc = window.players[infoID].oldProjectedLoc;
				}
				let insertedDamageText = new DamageText(projectedLoc[0], projectedLoc[1], "Kill", "critical");
            }
            if (infoID == playerID) {
                window.rotationLocked = true;
                window.players = [];
                //window.structures = [];
                //structureCounts = [];
                window.bullets = [];
                //window.playerNames = [];
                window.playerColors = []
                window.playerAllegiances = [];
                kills = 0;
                window.hideGameUI();
                //window.ws.removeEventListener('message', mainHandler);
                window.ws.addEventListener('message', waitJoin);
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.STRUCTURE_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoType = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infoDir = msgpack.expectNumb(recieved);
            let infoOwner = msgpack.expectNumb(recieved);
            while (typeof infoID !== 'undefined') {
                if (infoOwner == playerID) {
                    window.incrementStruc(infoType);
                    if (infoType == 16) {
                        if (countdownTimer !== undefined) {
                            countdownTimer = undefined;
                        }
                    }
                }
                window.structures[infoID] = new Structure(infoID, infoType, infoX, infoY, infoDir, infoOwner);
				window.cacheStructure(window.structures[infoID]);
				
				let specialCode = msgpack.expectString(recieved);
				if ((typeof specialCode  != 'undefined') && (specialCode  == "BOX")) {
					let item = msgpack.expectNumb(recieved);
					let qty = msgpack.expectNumb(recieved);
					if ((typeof item != 'undefined') && (typeof qty != 'undefined')) {
						window.structures[infoID].boxItem = item;
						window.structures[infoID].boxQty = qty;
					}
				}
				
				if ((typeof specialCode != 'undefined') && (specialCode == "CRAFTWAIT")) {
					let craftTime = msgpack.expectNumb(recieved);
					window.structures[infoID].infoCraftTime = craftTime * 1000;
					window.structures[infoID].infoCraftStart = window.performance.now();
				}
				
                infoID = msgpack.expectNumb(recieved);
                infoType = msgpack.expectNumb(recieved);
                infoX = msgpack.expectNumb(recieved);
                infoY = msgpack.expectNumb(recieved);
                infoDir = msgpack.expectNumb(recieved);
                infoOwner = msgpack.expectNumb(recieved);
            }
        }
        else if (data[0] == msgpack.BULLET_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infovX = msgpack.expectPosNegNumb(recieved);
            let infovY = msgpack.expectPosNegNumb(recieved);
            let infoType = msgpack.expectNumb(recieved);
            if (infoID !== undefined) {
                window.bullets[infoID] = [window.performance.now(), infoID, infoX, infoY, infovX, infovY, infoType];
            }
        }
        else if (data[0] == msgpack.BULLET_DESTROY_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            if (infoID !== undefined) {
                window.bullets[infoID] = undefined;
            }
        }
        else if (data[0] == msgpack.STRUCTURE_DESTROY_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            while (infoID !== undefined) {
                if (window.structures[infoID] !== undefined) {
                    if (window.structures[infoID].infoOwner == playerID) {
                        window.decrementStruc(window.structures[infoID].infoType);
                    }
                    window.structures[infoID] = undefined;
                }
                infoID = msgpack.expectNumb(recieved);
            }
        }
        else if (data[0] == msgpack.PLAYER_NAME_UPDATE) {
            let infoID = msgpack.expectNumb(recieved);
            let infoName = msgpack.expectString(recieved);
            let infoColor = msgpack.expectNumb(recieved);
            let infoTeam = msgpack.expectNumb(recieved);
            if (infoID !== undefined) {
                if (infoTeam !== undefined) {
                    window.playerAllegiances[infoID] = infoTeam;
                    window.playerNames[infoID] = "[" + window.clans[infoTeam][0] + "] " + infoName;
                }
                else {
                    window.playerNames[infoID] = infoName;
                    window.playerAllegiances[infoID] = undefined;
                }
                if (infoColor == undefined) {
                    window.playerColors[infoID] = 0;
                }
                else {
                    window.playerColors[infoID] = infoColor;
                }
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.CLAN_DESTROY_DELIM) {
            let infoTeam = msgpack.expectNumb(recieved);
            if (infoTeam !== undefined) {
                window.clans[infoTeam] = undefined;
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.PING) {
            if (data.length == 5) {
                document.getElementById('disconnected').innerText = "Disconnected: Server limit of 1 connection per IP address";
                window.ws.close();
            }
            else {
                let elapsed = window.performance.now() - lastPing;
                ping = elapsed;
                window.updateStrucDiv();
            }
        }
        else if (data[0] == msgpack.CHAT) {
            let infoID = msgpack.expectNumb(recieved);
            let infoMsg = msgpack.expectString(recieved);
            if ((infoID !== undefined) && 
                (infoMsg !== undefined)) {
                let name = window.playerNames[infoID]; 
                name += " [" + infoID + "]";
                let chatDiv = document.createElement('div');
                chatDiv.classList.add('chatEntryDiv');
                chatDiv.innerHTML = name + ": " + infoMsg + "<br>"; // haha xss go brr
                document.getElementById('chatDisplay').prepend(chatDiv);
            }
        }
        else if (data[0] == msgpack.NEW_CLAN_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoName = msgpack.expectString(recieved);
            let infoOwner = msgpack.expectNumb(recieved);
            while (typeof infoID !== 'undefined') {
                window.clans[infoID] = [infoName, infoOwner];
                infoID = msgpack.expectNumb(recieved);
                infoName = msgpack.expectString(recieved);
                infoOwner = msgpack.expectNumb(recieved);
                window.processTeamMenu();
            }
        }
        else if (data[0] == msgpack.CLAN_REQUEST_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            if (typeof infoID !== 'undefined') {
                let name = window.playerNames[infoID];
                let requestDiv = document.createElement("div");
                requestDiv.innerText = "Click to accept player " + name + " (ID " + infoID + ")";
                requestDiv.style.color = "#FF0000";
                requestDiv.classList.add('chatEntryDiv');
                requestDiv.addEventListener('click', function() {
                    window.ws.send(new Uint8Array(msgpack.addString([msgpack.CHAT], '/clan-accept ' + infoID)));
                    requestDiv.innerText = "Player " + name + " (ID " + infoID + ") was accepted";
                });
                let lineBreak = document.createElement("br");
                chatDisplay.prepend(lineBreak);
                chatDisplay.prepend(requestDiv);
                //chatDisplay.innerText = "Sys> Player " + infoID + " (" + name + ") wants to join\n" + chatDisplay.innerText;
            }
        }
        else if (data[0] == msgpack.LEADERBOARD_UPDATE_DELIM) {
            let infoID = msgpack.expectNumb(recieved);
            let infoScore = msgpack.expectNumb(recieved);
            let leaderboardText = "";
            while (infoID !== undefined) {
                leaderboardText = window.playerNames[infoID] + " [" + infoID + "]: " + infoScore + " kp\n" + leaderboardText;
                infoID = msgpack.expectNumb(recieved);
                infoScore = msgpack.expectNumb(recieved);
            }
            leaderboardText = "Leaderboard:\n" + leaderboardText;
            document.getElementById('leaderboard').innerText = leaderboardText;
        }
        else if (data[0] == msgpack.SCORE_UPDATE_DELIM) {
            let infoKills = msgpack.expectNumb(recieved);
            kills = infoKills;
            window.updateStrucDiv();
        }
        else if (data[0] == msgpack.TEAM_LOCATION_DELIM) {
            minimaprenderCounter = 0;
            let shouldPing = msgpack.expectPing(recieved);
            if (shouldPing == true) {
                beginMinimapUpdate(true);
            }
            else {
                beginMinimapUpdate(false);
            }
            let infoID = msgpack.expectNumb(recieved);
            shouldPing = msgpack.expectPing(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let processedIndex = 0;
            let wasPinging = false;
            minictx.fillStyle = '#0000FF';
            while (infoID !== undefined) {
                let fillRadius = 4;
                if (processedIndex == 1) {
                    minictx.fillStyle = '#FFFFFF';
                }
                if (shouldPing == true) {
                    minictx.fillStyle = '#FF0000';
                    fillRadius = 7;
                    wasPinging = true;
                }
                else if (wasPinging == true) {
                    wasPinging = false;
                    minictx.fillStyle = '#FFFFFF';
                }
                if (infoID !== playerID) {
                    minictx.beginPath();
                    minictx.arc(infoX * (minimapCanvas.width / config.MAP_X), minimapCanvas.height - infoY * (minimapCanvas.height / config.MAP_Y), fillRadius, 0, 2 * Math.PI);
                    minictx.fill();
                }
                infoID = msgpack.expectNumb(recieved);
                shouldPing = msgpack.expectPing(recieved);
                infoX = msgpack.expectNumb(recieved);
                infoY = msgpack.expectNumb(recieved);
                processedIndex += 1;
            }
        }
		else if (data[0] == msgpack.MISC) {
			let identifier = msgpack.expectString(recieved);
			if (identifier == 'INVUPDATE') {
				expectItemDetails(recieved);
                window.updateStrucDiv();
			}
			else if (identifier == 'CRAFTWAIT') {
				let crafterID = msgpack.expectNumb(recieved);
				let craftTime = msgpack.expectNumb(recieved);
				if (typeof window.structures[crafterID] != 'undefined') {
					window.structures[crafterID].infoCraftTime = craftTime * 1000;
					window.structures[crafterID].infoCraftStart = window.performance.now();
				}
			}
		}
    }
}

function expectItemDetails(recieved) {
	let actionBarLength = msgpack.expectArray(recieved);
	window.actionBarSlots = [];
	for (let j = 0; j < actionBarLength; j++) {
		let itemInfo = window.inventoryManager.expectItem(recieved);
		window.actionBarSlots.push(itemInfo);
	}
	window.populateSelectBarImages();
	
	let inventoryLength = msgpack.expectArray(recieved);
	window.inventorySlots = [];
	for (let j = 0; j < inventoryLength; j++) {
		let itemInfo = window.inventoryManager.expectItem(recieved);
		window.inventorySlots.push(itemInfo);
	}
	window.processInventory();
}

window.waitJoin = function(e) {
    let data = new Uint8Array(e.data);
    if (data.length != 0) {
        recieved.data = data;
        recieved.start = 1;
        if (data[0] == msgpack.JOIN) {
			let currTime = window.performance.now();
			lastUpdate = currTime;
			
            let theID = msgpack.expectNumb(recieved);
            let vScale = msgpack.expectNumb(recieved);
            let infoX = msgpack.expectNumb(recieved);
            let infoY = msgpack.expectNumb(recieved);
            let infoColor = msgpack.expectNumb(recieved);
            let infoCountdown = msgpack.expectNumb(recieved);
			
			expectItemDetails(recieved);
			
            let infoRecon = msgpack.expectString(recieved);

            if (infoColor == undefined) {
                myColor = 0;
            }
            else {
                myColor = infoColor;
            }
            if (infoCountdown == 1) {
                countdownTimer = window.performance.now();
            }
            else {
                countdownTimer = undefined;
            }
            window.playerID = theID;
            
            if (reconnectID == undefined) {
                reconnectID = infoRecon;
            }
			
			window.players[theID] = new Player(theID, infoX, infoY, 0, 0, config.MAX_HEALTH, currTime);
			window.projectedX = infoX;
			window.projectedY = infoY;

            VIEW_X = config.VIEW_X * vScale;
            VIEW_Y = config.VIEW_Y * vScale;
            HVIEW_X = VIEW_X/2;
            HVIEW_Y = VIEW_Y/2;
            
            window.ws.removeEventListener('message', waitJoin);
            window.ws.addEventListener('message', window.mainHandler);
            window.configCanvas();
            window.checkPing();
            window.drawLeaderboardBacker(theID);
        }
    }
}