"use strict";

/*
  MAISON ÉLAN 菜单数据（图片、名称、描述、分类）

  价格说明（v3.7 起）：
  - 线上（已配置 Supabase）：价格和上下架以数据库 menu_items 表为准，
    页面加载后会用数据库里的价格覆盖这里的数字，下单总价也由数据库计算。
  - 本机演示模式：使用这里的价格（美元）。
  - 改价请同时改 menu_items 表；新增菜品要在这里和 menu_items 表各加一条，id / key 保持一致。

  字段：name 中文菜名 · englishName 英文菜名 · price 美元单价 ·
        description 中文描述 · descriptionEn 英文描述 · image 图片路径
*/

window.MENU_DATA = {
  // 主厨推荐
  recommendations: [
    {
      "id": "recommendations-foie-gras-1",
      "name": "香煎鹅肝配无花果红酒汁",
      "englishName": "Pan-Seared Foie Gras",
      "price": 26,
      "image": "./assets/dishes/foie-gras.webp",
      "description": "外层焦香、内里柔润，搭配无花果与红酒酱汁，呈现细腻而浓郁的法式风味。",
      "descriptionEn": "Caramelized outside and silky within, finished with figs and a red wine reduction.",
      "badge": "SIGNATURE",
      "featured": true
    },
    {
      "id": "recommendations-duck-breast-2",
      "name": "香煎鸭胸配莓果酱汁",
      "englishName": "Pan-Seared Duck Breast",
      "price": 42,
      "image": "./assets/dishes/duck-breast.webp",
      "description": "鸭胸外皮酥脆，肉质柔嫩，莓果酸香平衡丰厚油脂。",
      "descriptionEn": "Crisp skin and tender meat, balanced by a bright berry sauce.",
      "badge": "",
      "featured": false
    },
    {
      "id": "recommendations-lamb-chops-3",
      "name": "法式香煎羊排",
      "englishName": "Grilled Lamb Chops",
      "price": 48,
      "image": "./assets/dishes/lamb-chops.webp",
      "description": "香草与黄油慢慢浸润羊排，保留鲜嫩肉汁与温暖香气。",
      "descriptionEn": "Basted slowly in herbs and butter to keep every chop juicy and fragrant.",
      "badge": "",
      "featured": false
    }
  ],

  // 前菜
  appetizers: [
    {
      "id": "appetizers-foie-gras-1",
      "name": "香煎鹅肝配无花果红酒汁",
      "englishName": "Pan-Seared Foie Gras",
      "price": 26,
      "image": "./assets/dishes/foie-gras.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "appetizers-escargots-2",
      "name": "勃艮第焗蜗牛",
      "englishName": "Escargots de Bourgogne",
      "price": 18,
      "image": "./assets/dishes/escargots.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "appetizers-salmon-tartare-3",
      "name": "烟熏三文鱼塔塔",
      "englishName": "Smoked Salmon Tartare",
      "price": 21,
      "image": "./assets/dishes/salmon-tartare.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "appetizers-nicoise-salad-4",
      "name": "尼斯沙拉",
      "englishName": "Salade Niçoise",
      "price": 17,
      "image": "./assets/dishes/nicoise-salad.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    }
  ],

  // 汤品
  soups: [
    {
      "id": "soups-onion-soup-1",
      "name": "法式洋葱汤",
      "englishName": "French Onion Soup",
      "price": 14,
      "image": "./assets/dishes/onion-soup.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "soups-cream-mushroom-soup-2",
      "name": "奶油蘑菇浓汤",
      "englishName": "Cream of Mushroom Soup",
      "price": 12,
      "image": "./assets/dishes/cream-mushroom-soup.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "soups-lobster-bisque-3",
      "name": "龙虾浓汤",
      "englishName": "Lobster Bisque",
      "price": 19,
      "image": "./assets/dishes/lobster-bisque.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "soups-pumpkin-soup-4",
      "name": "南瓜浓汤",
      "englishName": "Pumpkin Velouté",
      "price": 12,
      "image": "./assets/dishes/pumpkin-soup.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    }
  ],

  // 主菜
  mains: [
    {
      "id": "mains-beef-bourguignon-1",
      "name": "红酒炖牛肉",
      "englishName": "Boeuf Bourguignon",
      "price": 39,
      "image": "./assets/dishes/beef-bourguignon.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "mains-duck-breast-2",
      "name": "香煎鸭胸配莓果酱汁",
      "englishName": "Pan-Seared Duck Breast",
      "price": 42,
      "image": "./assets/dishes/duck-breast.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "mains-sea-bass-3",
      "name": "香草黄油海鲈鱼",
      "englishName": "Herb Butter Sea Bass",
      "price": 38,
      "image": "./assets/dishes/sea-bass.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "mains-roast-chicken-4",
      "name": "普罗旺斯烤鸡",
      "englishName": "Provençal Roasted Chicken",
      "price": 32,
      "image": "./assets/dishes/roast-chicken.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "mains-truffle-pasta-5",
      "name": "松露奶油烩意面",
      "englishName": "Truffle Cream Pasta",
      "price": 29,
      "image": "./assets/dishes/truffle-pasta.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "mains-lamb-chops-6",
      "name": "法式香煎羊排",
      "englishName": "Grilled Lamb Chops",
      "price": 48,
      "image": "./assets/dishes/lamb-chops.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    }
  ],

  // 甜品
  desserts: [
    {
      "id": "desserts-creme-brulee-1",
      "name": "焦糖布丁",
      "englishName": "Crème Brûlée",
      "price": 12,
      "image": "./assets/dishes/creme-brulee.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "desserts-lemon-tart-2",
      "name": "柠檬塔",
      "englishName": "Lemon Tart",
      "price": 12,
      "image": "./assets/dishes/lemon-tart.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "desserts-lava-cake-3",
      "name": "熔岩巧克力蛋糕",
      "englishName": "Chocolate Lava Cake",
      "price": 14,
      "image": "./assets/dishes/lava-cake.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "desserts-souffle-4",
      "name": "香草舒芙蕾",
      "englishName": "Vanilla Soufflé",
      "price": 15,
      "image": "./assets/dishes/souffle.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    }
  ],

  // 饮品
  drinks: [
    {
      "id": "drinks-sparkling-water-1",
      "name": "气泡矿泉水",
      "englishName": "Sparkling Water",
      "price": 7,
      "image": "./assets/drinks/sparkling-water.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "drinks-americano-2",
      "name": "美式咖啡",
      "englishName": "Americano",
      "price": 5,
      "image": "./assets/drinks/americano.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "drinks-hot-chocolate-3",
      "name": "法式热可可",
      "englishName": "French Hot Chocolate",
      "price": 7,
      "image": "./assets/drinks/hot-chocolate.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "drinks-citrus-soda-4",
      "name": "柑橘苏打特调",
      "englishName": "Citrus Soda",
      "price": 8,
      "image": "./assets/drinks/citrus-soda.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    },
    {
      "id": "drinks-grape-juice-5",
      "name": "葡萄汁",
      "englishName": "Grape Juice",
      "price": 7,
      "image": "./assets/drinks/grape-juice.webp",
      "description": "",
      "descriptionEn": "",
      "badge": "",
      "featured": false
    }
  ],

  // 精选葡萄酒
  wines: [
    {
      "id": "wines-bordeaux-1",
      "name": "波尔多干红",
      "englishName": "Bordeaux Rouge",
      "region": "BORDEAUX · FRANCE",
      "image": "./assets/wines/bordeaux.webp",
      "glassPrice": 16,
      "bottlePrice": 62
    },
    {
      "id": "wines-pinot-noir-2",
      "name": "勃艮第黑皮诺",
      "englishName": "Bourgogne Pinot Noir",
      "region": "BOURGOGNE · FRANCE",
      "image": "./assets/wines/pinot-noir.webp",
      "glassPrice": 19,
      "bottlePrice": 78
    },
    {
      "id": "wines-chardonnay-3",
      "name": "勃艮第霞多丽",
      "englishName": "Bourgogne Chardonnay",
      "region": "BOURGOGNE · FRANCE",
      "image": "./assets/wines/chardonnay.webp",
      "glassPrice": 18,
      "bottlePrice": 72
    },
    {
      "id": "wines-sauvignon-blanc-4",
      "name": "长相思白葡萄酒",
      "englishName": "Sauvignon Blanc",
      "region": "LOIRE · FRANCE",
      "image": "./assets/wines/sauvignon-blanc.webp",
      "glassPrice": 15,
      "bottlePrice": 58
    },
    {
      "id": "wines-prosecco-5",
      "name": "普罗塞克起泡酒",
      "englishName": "Prosecco",
      "region": "VENETO · ITALIA",
      "image": "./assets/wines/prosecco.webp",
      "glassPrice": 14,
      "bottlePrice": 54
    },
    {
      "id": "wines-rose-wine-6",
      "name": "桃红葡萄酒",
      "englishName": "Rosé Wine",
      "region": "PROVENCE · FRANCE",
      "image": "./assets/wines/rose-wine.webp",
      "glassPrice": 15,
      "bottlePrice": 58
    }
  ]

};
