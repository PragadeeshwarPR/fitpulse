/**
 * Seeds the global food database (userId = null). Values are typical per-serving
 * estimates compiled from public nutrition references; idempotent by name.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// name, serving, grams, kcal, protein, carbs, fat, fibre, sugar, sodium(mg)
type Row = [string, string, number, number, number, number, number, number, number, number];
const FOODS: Row[] = [
  // Indian
  ["Idli", "1 piece", 50, 70, 2, 15, 0.3, 0.7, 0.2, 120],
  ["Sambar", "1 cup", 200, 140, 6, 17, 4, 4, 3, 520],
  ["Plain dosa", "1 medium", 85, 165, 3.9, 29, 3.7, 0.9, 0.3, 190],
  ["Masala dosa", "1 medium", 160, 300, 6, 45, 10, 3, 2, 450],
  ["Coconut chutney", "2 tbsp", 30, 60, 0.8, 2.5, 5.5, 1.5, 0.8, 70],
  ["Upma", "1 cup", 200, 250, 6, 38, 8, 3, 2, 480],
  ["Poha", "1 cup", 160, 250, 4.5, 45, 6, 2, 3, 400],
  ["Chapati", "1 medium", 40, 120, 3.1, 18, 3.7, 2.7, 0.4, 120],
  ["Paratha (plain)", "1 piece", 80, 260, 5, 36, 11, 3, 1, 300],
  ["Steamed white rice", "1 cup cooked", 158, 205, 4.3, 45, 0.4, 0.6, 0.1, 2],
  ["Brown rice", "1 cup cooked", 195, 218, 4.5, 46, 1.6, 3.5, 0.7, 2],
  ["Dal (toor, cooked)", "1 cup", 200, 230, 13, 32, 6, 8, 2, 400],
  ["Rajma curry", "1 cup", 240, 280, 13, 38, 8, 11, 3, 520],
  ["Chana masala", "1 cup", 240, 300, 12, 40, 10, 10, 6, 560],
  ["Paneer butter masala", "1 cup", 240, 450, 16, 14, 36, 2, 7, 700],
  ["Palak paneer", "1 cup", 240, 330, 15, 12, 25, 4, 4, 600],
  ["Chicken biryani", "1 plate", 350, 550, 28, 65, 18, 2, 3, 900],
  ["Vegetable biryani", "1 plate", 350, 450, 10, 70, 14, 5, 4, 800],
  ["Butter chicken", "1 cup", 240, 440, 30, 12, 30, 2, 8, 850],
  ["Chicken curry", "1 cup", 240, 330, 28, 8, 20, 2, 3, 700],
  ["Fish curry", "1 cup", 240, 280, 25, 8, 16, 2, 3, 650],
  ["Curd / plain yogurt", "1 cup", 245, 150, 8.5, 11.4, 8, 0, 11.4, 113],
  ["Raita", "1/2 cup", 120, 80, 4, 6, 4, 0.5, 5, 200],
  ["Samosa", "1 piece", 100, 260, 4, 30, 14, 3, 2, 420],
  ["Pav bhaji", "1 plate", 300, 600, 14, 80, 24, 9, 10, 1200],
  ["Masala chai", "1 cup", 200, 110, 3, 15, 4, 0, 13, 50],
  ["Gulab jamun", "1 piece", 40, 150, 2, 22, 6, 0.3, 18, 30],
  ["Khichdi", "1 cup", 240, 260, 9, 44, 5, 5, 1, 450],
  ["Vada (medu)", "1 piece", 50, 140, 4, 14, 8, 2, 0.5, 200],
  // International
  ["Oats (cooked with water)", "1 cup", 234, 166, 5.9, 28, 3.6, 4, 0.6, 9],
  ["Whole egg (boiled)", "1 large", 50, 78, 6.3, 0.6, 5.3, 0, 0.6, 62],
  ["Egg white", "1 large", 33, 17, 3.6, 0.2, 0.1, 0, 0.2, 55],
  ["Omelette (2 eggs)", "1 omelette", 120, 190, 13, 1, 15, 0, 1, 340],
  ["Chicken breast (grilled)", "100 g", 100, 165, 31, 0, 3.6, 0, 0, 74],
  ["Salmon (baked)", "100 g", 100, 206, 22, 0, 12, 0, 0, 61],
  ["Tuna (canned in water)", "100 g", 100, 116, 26, 0, 0.8, 0, 0, 338],
  ["Tofu (firm)", "100 g", 100, 144, 17, 3, 9, 2, 0.6, 14],
  ["Paneer", "100 g", 100, 265, 18, 3.6, 20, 0, 2.6, 18],
  ["Greek yogurt (nonfat)", "170 g", 170, 100, 17, 6, 0.7, 0, 6, 61],
  ["Milk (whole)", "1 cup", 244, 149, 7.7, 11.7, 7.9, 0, 12.3, 105],
  ["Milk (skim)", "1 cup", 245, 83, 8.3, 12.2, 0.2, 0, 12.5, 103],
  ["Whey protein shake", "1 scoop + water", 30, 120, 24, 3, 1.5, 0, 2, 50],
  ["Banana", "1 medium", 118, 105, 1.3, 27, 0.4, 3.1, 14.4, 1],
  ["Apple", "1 medium", 182, 95, 0.5, 25, 0.3, 4.4, 18.9, 2],
  ["Orange", "1 medium", 131, 62, 1.2, 15.4, 0.2, 3.1, 12.2, 0],
  ["Mango", "1 cup sliced", 165, 99, 1.4, 24.7, 0.6, 2.6, 22.5, 2],
  ["Blueberries", "1 cup", 148, 84, 1.1, 21, 0.5, 3.6, 14.7, 1],
  ["Almonds", "28 g", 28, 164, 6, 6.1, 14.2, 3.5, 1.2, 0],
  ["Peanut butter", "2 tbsp", 32, 190, 7, 7, 16, 2, 3, 140],
  ["Whole wheat bread", "1 slice", 32, 80, 4, 14, 1, 2, 1.5, 140],
  ["White bread", "1 slice", 25, 67, 2, 12.7, 0.8, 0.6, 1.4, 125],
  ["Pasta (cooked)", "1 cup", 140, 220, 8, 43, 1.3, 2.5, 0.8, 1],
  ["Quinoa (cooked)", "1 cup", 185, 222, 8.1, 39, 3.6, 5.2, 1.6, 13],
  ["Sweet potato (baked)", "1 medium", 114, 103, 2.3, 24, 0.2, 3.8, 7.4, 41],
  ["Broccoli (steamed)", "1 cup", 156, 55, 3.7, 11.2, 0.6, 5.1, 2.2, 64],
  ["Mixed green salad", "1 bowl", 150, 30, 2, 6, 0.3, 2.5, 2.5, 40],
  ["Avocado", "1/2 fruit", 100, 160, 2, 8.5, 14.7, 6.7, 0.7, 7],
  ["Pizza (cheese)", "1 slice", 107, 285, 12, 36, 10, 2.5, 3.8, 640],
  ["Burger (beef)", "1 burger", 220, 540, 25, 40, 30, 2, 8, 1000],
  ["French fries", "medium serving", 117, 365, 4, 48, 17, 4.4, 0.3, 246],
  ["Fried rice", "1 cup", 200, 330, 8, 50, 11, 1.5, 2, 800],
  ["Hakka noodles", "1 plate", 250, 400, 9, 58, 15, 3, 4, 1100],
  ["Dark chocolate (70%)", "20 g", 20, 120, 1.6, 9, 8.5, 2.2, 4.8, 4],
  ["Coca-Cola", "330 ml can", 330, 139, 0, 35, 0, 0, 35, 15],
  ["Orange juice", "1 cup", 248, 112, 1.7, 25.8, 0.5, 0.5, 20.8, 2],
  ["Black coffee", "1 cup", 240, 2, 0.3, 0, 0, 0, 0, 5],
];

async function main() {
  let created = 0;
  for (const [name, servingDesc, servingG, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg] of FOODS) {
    const exists = await prisma.foodItem.findFirst({ where: { userId: null, name } });
    if (exists) continue;
    await prisma.foodItem.create({
      data: { name, servingDesc, servingG, calories, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg, isFavorite: false },
    });
    created++;
  }
  console.info(`Seeded ${created} food items (${FOODS.length} total in catalogue).`);
}

main().finally(() => prisma.$disconnect());
