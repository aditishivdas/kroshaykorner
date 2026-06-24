/* =====================================================================
   KroshayKorner — Product Data
   ---------------------------------------------------------------------
   This is the ONLY file you need to edit to add, remove, or update
   products on the website. Save the file and refresh the browser.

   Each product:
   {
     id:          unique number
     name:        product title
     category:    must match one of CATEGORIES below (or add a new one)
     price:       number in INR (₹)
     description: 1–2 short lines
     image:       a public image URL (Unsplash, your CDN, etc.)
                  — OR leave empty "" to use the built-in crochet artwork
     art:         optional — "flower" | "bag" | "toy" | "yarn" | "heart"
                  used only when image is empty
     badge:       optional small tag e.g. "Bestseller", "New"
   }
   ===================================================================== */

const CATEGORIES = [
  "All",
  "Crochet Bags",
  "Crochet Flowers",
  "Crochet Toys",
  "Crochet Accessories",
  "Custom Handmade Gifts",
  "New Arrivals"
];

const PRODUCTS = [
  {
    id: 1,
    name: "Blossom Crochet Flower",
    category: "Crochet Flowers",
    price: 199,
    description: "Handcrafted crochet flowers made with love, perfect for gifts and decoration.",
    image: "",
    art: "flower",
    badge: "Bestseller"
  },
  {
    id: 2,
    name: "Cottage Tote Bag",
    category: "Crochet Bags",
    price: 699,
    description: "Unique handmade crochet bag designed with creativity and care.",
    image: "",
    art: "bag",
    badge: ""
  },
  {
    id: 3,
    name: "Tiny Bear Plushie",
    category: "Crochet Toys",
    price: 499,
    description: "Cute handmade crochet toy created to bring smiles.",
    image: "",
    art: "toy",
    badge: "New"
  },
  {
    id: 4,
    name: "Daisy Hair Clip Set",
    category: "Crochet Accessories",
    price: 249,
    description: "Soft pastel daisy clips — a dainty everyday accessory.",
    image: "",
    art: "flower",
    badge: ""
  },
  {
    id: 5,
    name: "Custom Name Keychain",
    category: "Custom Handmade Gifts",
    price: 299,
    description: "Personalised crochet keychain made just for you or someone special.",
    image: "",
    art: "heart",
    badge: ""
  },
  {
    id: 6,
    name: "Sunflower Bouquet",
    category: "Crochet Flowers",
    price: 449,
    description: "A forever bouquet of sunshine — never wilts, always smiles.",
    image: "",
    art: "flower",
    badge: ""
  },
  {
    id: 7,
    name: "Mini Bunny Charm",
    category: "Crochet Toys",
    price: 199,
    description: "Pocket-sized bunny charm to clip on your bag or keys.",
    image: "",
    art: "toy",
    badge: "New"
  },
  {
    id: 8,
    name: "Pastel Bucket Bag",
    category: "Crochet Bags",
    price: 899,
    description: "Soft pastel bucket bag with a sturdy braided handle.",
    image: "",
    art: "bag",
    badge: ""
  },
  {
    id: 9,
    name: "Cosy Ear Warmer",
    category: "New Arrivals",
    price: 349,
    description: "A warm crochet headband for breezy mornings and cosy evenings.",
    image: "",
    art: "yarn",
    badge: "New"
  }
];

/* WhatsApp number used for the "Order on WhatsApp" buttons.
   Use international format without "+" or spaces.            */
const ORDER_WHATSAPP = "917550281520";

window.KROSHAY_DATA = { CATEGORIES, PRODUCTS, ORDER_WHATSAPP };
