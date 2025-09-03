import { loadImage } from '@/utils/canvas';
import type { Cook, CookingStage } from './types';
import { CAT_ID } from '@/containers/PizzeriaSimulator/Simulator';

type CoordinateShiftCoefficient = number;

const COOK_POSITIONS: Record<CookingStage, [number, number, CoordinateShiftCoefficient, CoordinateShiftCoefficient]> = {
  Baking: [1060, 180, +1, +0.5],
  Dough: [770, 360, +1, +0.6],
  Packaging: [1170, 400, +1, 0],
  Topping: [780, 230, +1, -0.5],
  Completed: [1000, 350, 0, 0],
  Waiting: [1000, 350, 0, 0]
};

const cooksImages: Partial<Record<CookingStage, HTMLImageElement>> = {};
let iceImage: HTMLImageElement, catImageRight: HTMLImageElement, catImageBack: HTMLImageElement;

const rightStages = ['Baking', 'Packaging'];
const leftStages = ['Completed', 'Waiting', 'Dough'];
const backStages = ['Topping'];

const loadCookImages = async () => {
  const backCook = await loadImage('/images/cook.png');
  const cookWithPizza = await loadImage('/images/cook2.png');
  const sideCook = await loadImage('/images/cook3.png');
  const doughCook = await loadImage('/images/cook3(with dough).png');
  cooksImages.Baking = sideCook;
  cooksImages.Dough = doughCook;
  cooksImages.Packaging = cookWithPizza;
  const restingCook = await loadImage('/images/cook4.png');
  cooksImages.Topping = backCook;

  cooksImages.Completed = restingCook;
  cooksImages.Waiting = restingCook;
  catImageRight = await loadImage('/images/cat-right.png');
  // cat-left.png removed from runtime usage; we mirror cat-right sprite instead
  catImageBack = await loadImage('/images/cat-back.png');
  iceImage = await loadImage('/images/ice.png');
};

loadCookImages();

export class CanvasCook {
  cookData: Cook;
  currentStage: CookingStage;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  moving: boolean;
  isFrozen: boolean;
  resortCooks: () => void;

  constructor(
    cookData: Cook,
    currentStage: CookingStage,
    stageCooksCount: number,
    resortCooks: () => void
  ) {
    this.cookData = cookData;
    this.currentStage = currentStage;

    const [x, y, dx, dy] = COOK_POSITIONS[currentStage];
    if (stageCooksCount > 6) {
      if (stageCooksCount > 11) {
        [this.targetX, this.targetY] = [x, y];
      } else {
        [this.targetX, this.targetY] = [
          x + (25 * dx) + dx * (stageCooksCount - 6) * 50,
          y + (25 * dy) + dy * (stageCooksCount - 6) * 50
        ];
      }
    } else {
      [this.targetX, this.targetY] = [x + dx * stageCooksCount * 50, y + dy * stageCooksCount * 50];
    }

    this.moving = false;

    this.x = this.targetX;
    this.y = this.targetY;
    this.isFrozen = cookData.status === 'PAUSED';
    this.resortCooks = resortCooks;
  }

  moveTo(stage: CookingStage, cooks: CanvasCook[]) {
    stage = stage === 'Completed' ? 'Waiting' : stage;
    const [x, y] = findFreePlace(cooks, stage);
    this.targetX = x;
    this.targetY = y;
    this.currentStage = stage;
    this.moving = true;
  }

  updatePosition() {
    if (!this.moving) return;

    const step = 1;
    if (Math.abs(this.targetX - this.x) > step || Math.abs(this.targetY - this.y) > step) {
      this.x += (this.targetX - this.x) > 0 ? step : -step;
      this.y += (this.targetY - this.y) > 0 ? step : -step;
    } else {
      this.resortCooks();
      this.x = this.targetX;
      this.y = this.targetY;
      this.moving = false;
    }
  }

  updateData(newData: Cook) {
    this.cookData = newData;
    this.isFrozen = newData.status === 'PAUSED';
  }

  draw(ctx: CanvasRenderingContext2D) {
    const cookImage = cooksImages[this.currentStage];
    if (this.cookData.id === CAT_ID) {
      handleCatSkin(ctx, this.x, this.y, this.currentStage);
      return;
    }

    if (cookImage) {
      ctx.drawImage(cookImage, this.x - cookImage.width / 2, this.y - cookImage.height / 2);

      ctx.fillStyle = '#000000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `${this.cookData.name} (#${this.cookData.id})`;

      ctx.fillText(label, this.x, this.y - cookImage.height / 2 - 10);
      ctx.fillText(this.cookData.specialization ?? 'Not specialized', this.x, this.y - cookImage.height / 2 + 5);

      if (this.isFrozen) {
        ctx.drawImage(iceImage, this.x - iceImage.width / 2, this.y - iceImage.height / 2);
      }
    } else {
      console.warn(`Image for ${this.currentStage} not loaded yet.`);
    }
  }

  isClicked(x: number, y: number) {
    const cookImage = cooksImages[this.currentStage];
    if (!cookImage) return false;
    const dx = Math.abs(this.x - x);
    const dy = Math.abs(this.y - y);
    return dx < cookImage.width / 2 && dy < cookImage.height / 2;
  }
}

function findFreePlace(cooks: CanvasCook[], stage: CookingStage): [number, number] {
  const [x, y, dx, dy] = COOK_POSITIONS[stage];
  for (let i = 0; i < 6; i++) {
    const freePlace = cooks
      .find((cook) =>
        cook.currentStage === stage && cook.targetX === x + dx * i * 50 && cook.targetY === y + dy * i * 50);
    if (!freePlace) return [x + dx * i * 50, y + dy * i * 50];
  }

  for (let i = 0; i < 5; i++) {
    const freePlace = cooks
      .find((cook) =>
        cook.currentStage === stage &&
        cook.targetX === x + (25 * dx) + dx * i * 50 &&
        cook.targetY === y + (25 * dy) + dy * i * 50
      );
    if (!freePlace) return [x + (25 * dx) + dx * i * 50, y + (25 * dy) + dy * i * 50];
  }

  return [x, y];
}

function handleCatSkin(ctx: CanvasRenderingContext2D, x: number, y: number, currentStage: CookingStage) {
  const scale = 0.225;

  const drawCat = (img: HTMLImageElement, opts?: { back?: boolean; flipX?: boolean }) => {
    const imgWidth = img.width * (scale - (opts?.back ? 0.05 : 0));
    const imgHeight = img.height * scale;

    ctx.save();
    if (opts?.flipX) {
      // Mirror horizontally around the cat's center point
      ctx.translate(x * 2, 0); // move origin so scaling flips around x
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, x - imgWidth / 2, y - imgHeight / 2, imgWidth, imgHeight);
    ctx.restore();

    ctx.fillStyle = '#000000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = `A cat (#${CAT_ID})`;
    ctx.fillText(label, x, y - img.height / 2 - 10);
  };

  if (rightStages.includes(currentStage) && catImageRight) {
    drawCat(catImageRight);
  }
  if (leftStages.includes(currentStage) && catImageRight) {
    // Mirror right-facing cat instead of loading a separate left sprite
    drawCat(catImageRight, { flipX: true });
  }
  if (backStages.includes(currentStage) && catImageBack) {
    drawCat(catImageBack, { back: true });
  }
}
