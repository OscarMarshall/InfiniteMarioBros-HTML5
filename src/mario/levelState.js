/**
	State for actually playing a randomly generated level.
	Code by Rob Kleffner, 2011
*/

Mario.LevelState = function(difficulty, type) {
    this.levelDifficulty = difficulty;
    this.levelType = type;
    this.level = null;
    this.layer = null;
    this.bgLayer = [];
    
    this.paused = false;
    this.sprites = null;
    this.spritesToAdd = null;
    this.spritesToRemove = null;
    this.camera = null;
    this.shellsToCheck = null;
    this.fireballsToCheck = null;
    
    this.fontShadow = null;
    this.font = null;
    
    this.timeLeft = 0;
    this.startTime = 0;
    this.fireballsOnScreen = 0;
    this.tick = 0;
    
    this.delta = 0;
	
	this.gotoMapState = false;
	this.gotoLoseState = false;
};

Mario.LevelState.prototype = new Enjine.GameState();

Mario.LevelState.prototype.enter = function() {
    var levelGenerator = new Mario.LevelGenerator(320, 15), i = 0, scrollSpeed = 0, w = 0, h = 0, bgLevelGenerator = null;
    this.level = levelGenerator.createLevel(this.levelType, this.levelDifficulty);
    
    //play music here
    //if (this.levelType === Mario.LevelType.overground) {
    	//Mario.playOvergroundMusic();
    //} else if (this.levelType === Mario.LevelType.underground) {
    	//Mario.playUndergroundMusic();
    //} else if (this.levelType === Mario.LevelType.castle) {
    	//Mario.playCastleMusic();
    //}
    
    this.paused = false;
    this.layer = new Mario.LevelRenderer(this.level, 320, 240);
    this.sprites = new Enjine.DrawableManager();
    this.camera = new Enjine.Camera();
    this.tick = 0;
    
    this.shellsToCheck = [];
    this.fireballsToCheck = [];
    this.spritesToAdd = [];
    this.spritesToRemove = [];
    
    this.fontShadow = Mario.SpriteCuts.createBlackFont();
    this.font = Mario.SpriteCuts.createWhiteFont();
    
    for (i = 0; i < 2; i++) {
        scrollSpeed = 4 >> i;
        w = ((((this.level.width * 16) - 320) / scrollSpeed) | 0) + 320;
        h = ((((this.level.height * 16) - 240) / scrollSpeed) | 0) + 240;
        bgLevelGenerator = new Mario.BackgroundGenerator(w / 32 + 1, h / 32 + 1, i === 0, this.levelType);
        this.bgLayer[i] = new Mario.BackgroundRenderer(bgLevelGenerator.createLevel(), 320, 240, scrollSpeed);
    }
    
    Mario.MarioCharacter.initialize(this);

    this.sprites.add(Mario.MarioCharacter);
    this.startTime = 1;
    this.timeLeft = 200;
	
	this.gotoMapState = false;
	this.gotoLoseState = false;
};

Mario.LevelState.prototype.exit = function() {
	
    delete this.level;
    delete this.layer;
    delete this.bgLayer;
    delete this.sprites;
    delete this.camera;
    delete this.shellsToCheck;
    delete this.fireballsToCheck;
    delete this.fontShadow;
    delete this.font;
};

Mario.LevelState.prototype.checkShellCollide = function(shell) {
    this.shellsToCheck.push(shell);
};

Mario.LevelState.prototype.checkFireballCollide = function(fireball) {
    this.fireballsToCheck.push(fireball);
};

Mario.LevelState.prototype.update = function(delta) {
    var i = 0, j = 0, xd = 0, yd = 0, sprite = null, hasShotCannon = false, xCannon = 0, x = 0, y = 0,
        dir = 0, st = null, b = 0;
    
    this.delta = delta;
	
    this.timeLeft -= delta;
    if ((this.timeLeft | 0) === 0) {
        Mario.MarioCharacter.die();
    }
    
    if (this.startTime > 0) {
        this.startTime++;
    }
    
    this.camera.x = Mario.MarioCharacter.x - 160;
    if (this.camera.x < 0) {
        this.camera.x = 0;
    }
    if (this.camera.x > this.level.width * 16 - 320) {
        this.camera.x = this.level.width * 16 - 320;
    }
    
    this.fireballsOnScreen = 0;
    
    for (i = 0; i < this.sprites.objects.length; i++) {
        sprite = this.sprites.objects[i];
        if (sprite !== Mario.MarioCharacter) {
            xd = sprite.x - this.camera.x;
            yd = sprite.y - this.camera.y;
            if (xd < -64 || xd > 320 + 64 || yd < -64 || yd > 240 + 64) {
                this.sprites.remove(sprite);
            } else {
                if (sprite instanceof Mario.Fireball) {
                    this.fireballsOnScreen++;
                }
            }
        }
    }
    
    if (this.paused) {
        for (i = 0; i < this.sprites.objects.length; i++) {
            if (this.sprites.objects[i] === Mario.MarioCharacter) {
                this.sprites.objects[i].update(delta);
            } else {
                this.sprites.objects[i].updateNoMove(delta);
            }
        }
    } else {
        this.layer.update(delta);
        this.level.update();
        
        hasShotCannon = false;
        xCannon = 0;
		this.tick++;
        
        for (x = ((this.camera.x / 16) | 0) - 1; x <= (((this.camera.x + this.layer.width) / 16) | 0) + 1; x++) {
            for (y = ((this.camera.y / 16) | 0) - 1; y <= (((this.camera.y + this.layer.height) / 16) | 0) + 1; y++) {
                dir = 0;
                
                if (x * 16 + 8 > Mario.MarioCharacter.x + 16) {
                    dir = -1;
                }
                if (x * 16 + 8 < Mario.MarioCharacter.x - 16) {
                    dir = 1;
                }
                
                st = this.level.getSpriteTemplate(x, y);
                
                if (st !== null) {
                    if (st.lastVisibleTick !== this.tick - 1) {
                        if (st.sprite === null || !this.sprites.contains(st.sprite)) {
                            st.spawn(this, x, y, dir);
                        }
                    }
                    
                    st.lastVisibleTick = this.tick;
                }
                
                if (dir !== 0) {
                    b = this.level.getBlock(x, y);
                    if (((Mario.Tile.behaviors[b & 0xff]) & Mario.Tile.animated) > 0) {
                        if ((((b % 16) / 4) | 0) === 3 && ((b / 16) | 0) === 0) {
                            if ((this.tick - x * 2) % 100 === 0) {
                                xCannon = x;
                                for (i = 0; i < 8; i++) {
                                    this.addSprite(new Mario.Sparkle(this, x * 16 + 8, y * 16 + ((Math.random() * 16) | 0), Math.random() * dir, 0, 0, 1, 5));
                                }
                                this.addSprite(new Mario.BulletBill(this, x * 16 + 8 + dir * 8, y * 16 + 15, dir));
                                hasShotCannon = true;
                            }
                        }
                    }
                }
            }
        }
        
        if (hasShotCannon) {
            Enjine.Resources.playSound("cannon");
        }
        
        for (i = 0; i < this.sprites.objects.length; i++) {
            this.sprites.objects[i].update(delta);
        }
        
        for (i = 0; i < this.sprites.objects.length; i++) {
            this.sprites.objects[i].collideCheck();
        }
        
        for (i = 0; i < this.shellsToCheck.length; i++) {
            for (j = 0; j < this.sprites.objects.length; j++) {
                if (this.sprites.objects[j] !== this.shellsToCheck[i] && !this.shellsToCheck[i].dead) {
                    if (this.sprites.objects[j].shellCollideCheck(this.shellsToCheck[i])) {
                        if (Mario.MarioCharacter.carried === this.shellsToCheck[i] && !this.shellsToCheck[i].dead) {
                            Mario.MarioCharacter.carried = null;
                            this.shellsToCheck[i].die();
                        }
                    }
                }
            }
        }
        this.shellsToCheck.length = 0;
        
        for (i = 0; i < this.fireballsToCheck.length; i++) {
            for (j = 0; j < this.sprites.objects.length; j++) {
                if (this.sprites.objects[j] !== this.fireballsToCheck[i] && !this.fireballsToCheck[i].dead) {
                    if (this.sprites.objects[j].fireballCollideCheck(this.fireballsToCheck[i])) {
                        this.fireballsToCheck[i].die();
                    }
                }
            }
        }
        
        this.fireballsToCheck.length = 0;
    }
    
    this.sprites.add(this.spritesToAdd);
    this.sprites.remove(this.spritesToRemove);
    this.spritesToAdd.length = 0;
    this.spritesToRemove.length = 0;
    
    this.camera.x = (Mario.MarioCharacter.xOld + (Mario.MarioCharacter.x - Mario.MarioCharacter.xOld) * delta) - 160;
    this.camera.y = (Mario.MarioCharacter.yOld + (Mario.MarioCharacter.y - Mario.MarioCharacter.yOld) * delta) - 120;
};

Mario.LevelState.prototype.draw = function(context) {
    var i = 0, time = 0, t = 0;
    
    if (this.camera.x < 0) {
        this.camera.x = 0;
    }
    if (this.camera.y < 0) {
        this.camera.y = 0;
    }
    if (this.camera.x > this.level.width * 16 - 320) {
        this.camera.x = this.level.width * 16 - 320;
    }
    if (this.camera.y > this.level.height * 16 - 240) {
        this.camera.y = this.level.height * 16 - 240;
    }
    
    for (i = 0; i < 2; i++) {
        this.bgLayer[i].draw(context, this.camera);
    }
    
    context.save();
    context.translate(-this.camera.x, -this.camera.y);
    for (i = 0; i < this.sprites.objects.length; i++) {
        if (this.sprites.objects[i].layer === 0) {
            this.sprites.objects[i].draw(context, this.camera);
        }
    }
    context.restore();
    
    this.layer.draw(context, this.camera);
    this.layer.drawExit0(context, this.camera, Mario.MarioCharacter.winTime === 0);
    
    context.save();
    context.translate(-this.camera.x, -this.camera.y);
    for (i = 0; i < this.sprites.objects.length; i++) {
        if (this.sprites.objects[i].layer === 1) {
            this.sprites.objects[i].draw(context, this.camera);
        }
    }
    context.restore();
    
    this.layer.drawExit1(context, this.camera);
    
    this.drawStringShadow(context, "MARIO " + Mario.MarioCharacter.lives, 0, 0);
    this.drawStringShadow(context, "00000000", 0, 1);
    this.drawStringShadow(context, "COIN", 14, 0);
    this.drawStringShadow(context, " " + Mario.MarioCharacter.coins, 14, 1);
    this.drawStringShadow(context, "WORLD", 24, 0);
    this.drawStringShadow(context, " " + Mario.MarioCharacter.levelString, 24, 1);
    this.drawStringShadow(context, "TIME", 34, 0);
    time = this.timeLeft | 0;
    if (time < 0) {
        time = 0;
    }
    this.drawStringShadow(context, " " + time, 34, 1);
    
    if (this.startTime > 0) {
        t = this.startTime + this.delta - 2;
        t = t * t * 0.6;
        this.renderBlackout(context, 160, 120, t | 0);
    }
    
    if (Mario.MarioCharacter.winTime > 0) {
    	//Mario.stopMusic();
        t = Mario.MarioCharacter.winTime + this.delta;
        t = t * t * 0.2;
        
        if (t > 900) {
            //TODO: goto map state with level won
			Mario.globalMapState.levelWon();
			this.gotoMapState = true;
        }
        
        this.renderBlackout(context, ((Mario.MarioCharacter.xDeathPos - this.camera.x) | 0), ((Mario.MarioCharacter.yDeathPos - this.camera.y) | 0), (320 - t) | 0);
    }
    
    if (Mario.MarioCharacter.deathTime > 0) {
    	//Mario.stopMusic();
        t = Mario.MarioCharacter.deathTime + this.delta;
        t = t * t * 0.1;
        
        if (t > 900) {
            //TODO: goto map with level lost
			Mario.MarioCharacter.lives--;
			this.gotoMapState = true;
			if (Mario.MarioCharacter.lives <= 0) {
				this.gotoLoseState = true;
			}
        }
        
        this.renderBlackout(context, ((Mario.MarioCharacter.xDeathPos - this.camera.x) | 0), ((Mario.MarioCharacter.yDeathPos - this.camera.y) | 0), (320 - t) | 0);
    }
};

Mario.LevelState.prototype.drawStringShadow = function(context, string, x, y) {
    this.font.strings[0] = { string: string, x: x * 8 + 4, y: y * 8 + 4 };
    this.fontShadow.strings[0] = { string: string, x: x * 8 + 5, y: y * 8 + 5 };
    this.fontShadow.draw(context, this.camera);
    this.font.draw(context, this.camera);
};

Mario.LevelState.prototype.renderBlackout = function(context, x, y, radius) {
    if (radius > 320) {
        return;
    }
    
    var xp = [], yp = [], i = 0;
    for (i = 0; i < 16; i++) {
        xp[i] = x + (Math.cos(i * Math.PI / 15) * radius) | 0;
        yp[i] = y + (Math.sin(i * Math.PI / 15) * radius) | 0;
    }
    xp[16] = 0;
    yp[16] = y;
    xp[17] = 0;
    yp[17] = 240;
    xp[18] = 320;
    yp[18] = 240;
    xp[19] = 320;
    yp[19] = y;
    
    context.fillStyle = "#000";
    context.beginPath();
    context.moveTo(xp[19], yp[19]);
    for (i = 18; i >= 0; i--) {
        context.lineTo(xp[i], yp[i]);
    }
    context.closePath();
    context.fill();
    
    for (i = 0; i < 16; i++) {
        xp[i] = x - (Math.cos(i * Math.PI / 15) * radius) | 0;
        yp[i] = y - (Math.sin(i * Math.PI / 15) * radius) | 0;
    }
    //cure a strange problem where the circle gets cut
    yp[15] += 5;
    
    xp[16] = 320;
    yp[16] = y;
    xp[17] = 320;
    yp[17] = 0;
    xp[18] = 0;
    yp[18] = 0;
    xp[19] = 0;
    yp[19] = y;
    
    context.fillStyle = "#000";
    context.beginPath();
    context.moveTo(xp[0], yp[0]);
    for (i = 0; i <= xp.length - 1; i++) {
        context.lineTo(xp[i], yp[i]);
    }
    context.closePath();
    context.fill();
};

Mario.LevelState.prototype.addSprite = function(sprite) {
    this.sprites.add(sprite);
};

Mario.LevelState.prototype.removeSprite = function(sprite) {
    this.sprites.remove(sprite);
};

Mario.LevelState.prototype.bump = function(x, y, canBreakBricks) {
    var block = this.level.getBlock(x, y), xx = 0, yy = 0;
    
    if ((Mario.Tile.behaviors[block & 0xff] & Mario.Tile.bumpable) > 0) {
        this.bumpInto(x, y - 1);
        this.level.setBlock(x, y, 4);
        this.level.setBlockData(x, y, 4);
        
        if ((Mario.Tile.behaviors[block & 0xff] & Mario.Tile.special) > 0) {
            Enjine.Resources.playSound("sprout");
            if (!Mario.MarioCharacter.large) {
                this.addSprite(new Mario.Mushroom(this, x * 16 + 8, y * 16 + 8));
            } else {
                this.addSprite(new Mario.FireFlower(this, x * 16 + 8, y * 16 + 8));
            }
        } else {
            Mario.MarioCharacter.getCoin();
            Enjine.Resources.playSound("coin");
            this.addSprite(new Mario.CoinAnim(this, x, y));
        }
    }
    
    if ((Mario.Tile.behaviors[block & 0xff] & Mario.Tile.breakable) > 0) {
        this.bumpInto(x, y - 1);
        if (canBreakBricks) {
            Enjine.Resources.playSound("breakblock");
            this.level.setBlock(x, y, 0);
            for (xx = 0; xx < 2; xx++) {
                for (yy = 0; yy < 2; yy++) {
                    this.addSprite(new Mario.Particle(this, x * 16 + xx * 8 + 4, y * 16 + yy * 8 + 4, (xx * 2 - 1) * 4, (yy * 2 - 1) * 4 - 8));
                }
            }
        }
    }
};

Mario.LevelState.prototype.bumpInto = function(x, y) {
    var block = this.level.getBlock(x, y), i = 0;
    if (((Mario.Tile.behaviors[block & 0xff]) & Mario.Tile.pickUpable) > 0) {
        Mario.MarioCharacter.getCoin();
        Enjine.Resources.playSound("coin");
        this.level.setBlock(x, y, 0);
        this.addSprite(new Mario.CoinAnim(x, y + 1));
    }
    
    for (i = 0; i < this.sprites.objects.length; i++) {
        this.sprites.objects[i].bumpCheck(x, y);
    }
};

Mario.LevelState.prototype.checkForChange = function(context) {
	if (this.gotoLoseState) {
		context.changeState(new Mario.LoseState());
	}
	else {
		if (this.gotoMapState) {
			context.changeState(Mario.globalMapState);
		}
	}
};