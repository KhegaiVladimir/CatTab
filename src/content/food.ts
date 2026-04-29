/**
 * Manages a single food item rendered inside the Shadow DOM.
 * Lifetime: spawn → cat arrives → despawn with eat animation.
 */
export class FoodSprite {
  private readonly el: HTMLDivElement;
  private removed = false;

  constructor(shadowRoot: ShadowRoot, x: number, y: number, fishUrl: string) {
    this.el = document.createElement('div');
    this.el.className = 'cattab-food';
    // Centre the food on the click point
    this.el.style.left = `${x - FOOD_SIZE / 2}px`;
    this.el.style.top = `${y - FOOD_SIZE / 2}px`;
    const img = document.createElement('img');
    img.src = fishUrl;
    img.width = FOOD_SIZE;
    img.height = FOOD_SIZE;
    img.style.imageRendering = 'pixelated';
    img.draggable = false;
    this.el.appendChild(img);
    shadowRoot.appendChild(this.el);
  }

  /**
   * Play eat-burst animation then remove from DOM.
   * Safe to call multiple times.
   */
  consume(): void {
    if (this.removed) return;
    this.removed = true;
    this.el.classList.add('cattab-food--eaten');
    setTimeout(() => this.el.remove(), 400);
  }

  /** Remove immediately (e.g. new food spawned while old one still exists). */
  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.el.remove();
  }
}

export const FOOD_SIZE = 36; // px — visual size of the emoji
