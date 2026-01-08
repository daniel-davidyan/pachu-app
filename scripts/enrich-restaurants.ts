/**
 * Restaurant Enrichment Script
 * 
 * This script:
 * 1. Deletes all existing restaurants from restaurant_cache
 * 2. Enriches restaurants from Google Places API
 * 3. Generates summaries using GPT-4o-mini
 * 4. Creates embeddings using text-embedding-3-small
 * 5. Inserts everything into the database
 * 
 * Usage: npx tsx scripts/enrich-restaurants.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// Validate required env vars
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('SUPABASE_URL:', !!SUPABASE_URL);
  console.error('SUPABASE_KEY:', !!SUPABASE_KEY);
  process.exit(1);
}

console.log('🔑 Using Supabase key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon');
if (!GOOGLE_API_KEY) {
  console.error('❌ Missing Google Places API key');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OpenAI API key');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Rate limiting helpers
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Raw restaurant data from user
const RAW_RESTAURANTS = `HOC - House of Coffee,32.0715,34.7685,
Waycup,32.0732,34.7745,
Cafelix,32.0585,34.7690,
Nahat,32.0778,34.7742,
Mae Cafe,32.0655,34.7730,
Ada Hanina,32.0545,34.7570,
Mirage,32.0610,34.7710,
Edmund,32.0640,34.7750,
Cafe Sheleg,32.0710,34.7675,
Yom Tov Cafe,32.0680,34.7690,
Tony & Esther,32.0590,34.7715,
Cafe Xoho,32.0785,34.7680,
Bucke,32.0645,34.7780,
Nola American Bakery,32.0880,34.7725,
Origem,32.0820,34.7750,
Cafe Poti,32.0685,34.7685,
Lorenz & Mintz,32.0615,34.7660,
Bicicletta,32.0640,34.7710,
Teder.fm,32.0605,34.7705,
Kuli Alma,32.0630,34.7740,
Sputnik,32.0645,34.7720,
Herzl 16,32.0635,34.7700,
Nile,32.0650,34.7715,
Phi Garden,32.0655,34.7760,
HaMinzar,32.0695,34.7695,
Lucille,32.0645,34.7710,
Muzner,32.0650,34.7755,
Uganda,32.0610,34.7705,
Salon Berlin,32.0720,34.7680,
Hoodna,32.0570,34.7720,
Abu Hassan,32.0535,34.7540,
Hummus Ashkara,32.0910,34.7790,
Shlomo & Doron,32.0675,34.7685,
Hummus Magen David,32.0690,34.7690,
HaKosem,32.0765,34.7765,
Jasmino,32.0640,34.7725,
Miznon,32.0745,34.7755,
Mifgash HaOsher,32.0740,34.7750,
HaShomer 1,32.0680,34.7680,
Panda Pita,32.0682,34.7688,
Itzik HaGadol,32.0550,34.7600,
Mifgash HaSteak,32.0705,34.7830,
Shipudei Tzipora,32.1050,34.8350,
Vitrina,32.0645,34.7790,
America Burger,32.0635,34.7720,
Prozor,32.0780,34.7725,
GDB,32.0760,34.7810,
Fat Cow,32.0950,34.7780,
Agadir,32.0980,34.7730,
Moses,32.0650,34.7780,
Pizza Lila,32.0590,34.7730,
Brooklyn Pizza,32.0850,34.7750,
Tony Vespa,32.0650,34.7770,
HaPizza,32.0770,34.7730,
Teder Pizza,32.0605,34.7705,
Artzieli,32.0580,34.7610,
Burekas Penso,32.0592,34.7712,
Burekas Amikam,32.0750,34.7850,
Lehamim,32.0700,34.7810,
Alexander,32.0660,34.7720,
Anita,32.0620,34.7670,
Otello,32.0830,34.7750,
Tamara,32.0845,34.7745,
Hamalabiya,32.0705,34.7680,
Giraffe,32.0780,34.7815,
River,32.0720,34.7830,
Zozobra,32.0920,34.7950,
Japanika,32.0770,34.7740,
Shi-Shi,32.0670,34.7790,
Nam,32.0945,34.7850,
Vong,32.0645,34.7750,
Moon,32.0785,34.7710,
Okinawa,32.0610,34.7665,
Fu Sushi,32.0955,34.7775,
Cafe Noir,32.0655,34.7765,
Cafe Italia,32.0715,34.7905,
Magazzino,32.0685,34.7810,
Rustico,32.0650,34.7760,
Amore Mio,32.0795,34.7810,
Gemma,32.0540,34.7570,
La Repubblica,32.0665,34.7735,
Landwer,32.0735,34.7730,
Aroma TLV,32.0780,34.7740,
Arcaffe,32.0640,34.7770,
Cafe Gan Sipur,32.0720,34.7850,
Reviva & Celia,32.0780,34.7900,
Falafel Gabay,32.0785,34.7725,
Dr Shakshuka,32.0545,34.7580,
Azura,32.0740,34.7900,
Hanan Margilan,32.0520,34.7730,
Salimi,32.0645,34.7715,
Shmulik Cohen,32.0575,34.7710,
Keton,32.0915,34.7745,
HaAchim,32.0760,34.7820,
Dok,32.0760,34.7822,
Abie,32.0710,34.7895,
M25,32.0680,34.7690,
Hudson,32.1090,34.8410,
Makom Shel Basar,32.0620,34.7660,
NG,32.0615,34.7655,
Goshen,32.0645,34.7705,
Lechem Basar,32.0735,34.7700,
Pankina,32.0775,34.7735,
Ca Phe Hanoi,32.0790,34.7810,
Malka,32.0725,34.7890,
Darya,32.0905,34.7705,
West Side,32.0700,34.7640,
Mexicana,32.0775,34.7760,
Taqueria,32.0625,34.7735,
Cafe Al-Noor,32.0755,34.7750,
Old Man and the Sea,32.0520,34.7505,
Onza,32.0550,34.7570,
Kalamata,32.0535,34.7525,
Greco,32.1250,34.7970,
Ouzeria,32.0590,34.7725,
Dalida,32.0592,34.7720,
Puaa,32.0545,34.7575,
Shaffa Bar,32.0548,34.7572,
Casino San Remo,32.0560,34.7620,
Par Derriere,32.0555,34.7615,
Concierge,32.0785,34.7745,
Bellboy,32.0655,34.7785,
Imperial,32.0740,34.7675,
Spicehaus,32.0780,34.7750,
Double Standard,32.0830,34.7745,
Mila,32.0860,34.7740,
Dizzy Frishdon,32.0780,34.7750,
Rubina,32.0725,34.7790,
Peacock,32.0725,34.7795,
Pasta Basta,32.0685,34.7695,
Wok Republic,32.0775,34.7740,
Breton,32.0765,34.7760,
Bana,32.0655,34.7735,
Opa,32.0595,34.7715,
Meshek Barzilay,32.0615,34.7650,
416,32.0695,34.7830,
Anastasia,32.0785,34.7750,
Rainbow,32.0770,34.7810,
Green Cat,32.0620,34.7740,
J17,32.0940,34.7770,
Zakaim,32.0650,34.7710,
Cafe Kaymak,32.0590,34.7725,
Shuffle Bar,32.0575,34.7705,
Romano,32.0605,34.7705,
North Abraxas,32.0645,34.7720,
HaSalon,32.0680,34.7890,
Dvora,32.0800,34.7690,
Cassata,32.0720,34.7680,
Tirza,32.0595,34.7720,
OCD,32.0560,34.7595,
Tenat,32.0565,34.7750,
Balinjera,32.0690,34.7675,
Seatara,32.1430,34.7930,
Turkiz,32.1430,34.7930,
Claro,32.0715,34.7875,
Tasting Room,32.0720,34.7870,
Whiskey Bar,32.0720,34.7875,
Max Brenner,32.0715,34.7870,
Goocha,32.0785,34.7750,
Cafe Bialik,32.0715,34.7710,
Cafe Tachtit,32.0665,34.7815,
Habima,32.0730,34.7790,
Susu & Sons,32.0770,34.7745,
Pizza Prego,32.0660,34.7770,
Bar Ochel,32.0680,34.7690,
Shmuel,32.0680,34.7690,
Burika,32.0685,34.7685,
Maganda,32.0695,34.7670,
Pasha,32.0550,34.7590,
Yalia,32.0555,34.7600,
Cafe Levinsky,32.0585,34.7710,
Golda Rothschild,32.0640,34.7780,
Golda Namal,32.0960,34.7730,
Golda Dizengoff,32.0800,34.7745,
Dominos Pizza,32.0790,34.7800,
McDonalds London Ministore,32.0760,34.7830,
McDonalds Dizengoff Center,32.0755,34.7755,
McDonalds Azrieli,32.0745,34.7915,
Aroma Dizengoff,32.0780,34.7740,
Aroma Azrieli,32.0745,34.7915,
Aroma Rothschild,32.0650,34.7790,
Arcaffe Habima,32.0730,34.7795,
Arcaffe Ramat Hahayal,32.1080,34.8420,
Landwer Rabin,32.0795,34.7810,
Landwer Namal,32.0965,34.7735,
Cafe 51,32.0645,34.7750,
Sybaris,32.0590,34.7720,
Cafe Zorik,32.0880,34.7830,
Cafe Masaryk,32.0760,34.7800,
Cafe Mersand,32.0780,34.7710,
Boutique Central,32.0730,34.7750,
Maison Kayser,32.0960,34.7730,
Fika,32.0780,34.7745,
Shako,32.0580,34.7600,
Cafelix Sgula,32.0570,34.7610,
Papua Cafe,32.0620,34.7690,
Little Prince Bookshop,32.0730,34.7760,
Tolaat Sfarim,32.0790,34.7810,
Cafe Shneor,32.0720,34.7720,
Dizengoff Cafe,32.0830,34.7750,
Loveat,32.0560,34.7590,
Bread & Co,32.0860,34.7745,
Stefan Gelato,32.0750,34.7770,
Buza,32.0740,34.7800,
Arte Glideria,32.0690,34.7690,
Pinoli,32.0760,34.7740,
Leggenda,32.0650,34.7780,
Siciliana,32.0780,34.7750,
La Tigre,32.0570,34.7710,
Saba Pizza,32.0810,34.7740,
Beccafico,32.0610,34.7660,
Nonno Angelo,32.0810,34.7735,
Philippe French Pizza,32.0680,34.7750,
Pizza Shiroko,32.0760,34.7790,
Pizza Agvania,32.0780,34.7740,
Giuseppe Pizza,32.0580,34.7720,
Pizzot,32.0760,34.7750,
Piazza,32.0780,34.7745,
Ernesto,32.0840,34.7710,
Mel & Michelle,32.0830,34.7705,
Italkia BaTachana,32.0590,34.7620,
Amalia,32.0750,34.7730,
Pomo,32.1080,34.8420,
Quattro,32.0700,34.7840,
Ze Sushi,32.0880,34.7820,
Nini Hachi,32.0860,34.7715,
Oshri,32.0680,34.7690,
Miazaki,32.0715,34.7870,
Aisan,32.0650,34.7730,
Peking Duck,32.0760,34.7720,
Hong Kong Dim Sum,32.0840,34.7710,
Kam-Son,32.0710,34.7780,
Thai House,32.0760,34.7710,
Oban Koban,32.0700,34.7830,
Kisu,32.0950,34.7800,
Nagisa,32.0715,34.7870,
Frame Chef & Sushi,32.1090,34.8410,
Minna Tomei,32.0700,34.7840,
Meat Bar,32.0740,34.7810,
Triger,32.0715,34.7870,
206 Meat,32.1150,34.8200,
Rak Basar,32.0540,34.7650,
Hatraklin Bistro,32.0620,34.7670,
Butcher's,32.0640,34.7710,
Marinado,32.0850,34.7740,
Meat Kitchen,32.0950,34.7730,
Memphis Burger,32.0680,34.7750,
Benz Brothers,32.0570,34.7720,
Gorgongonzola,32.0810,34.7740,
BBB,32.0700,34.7830,
Garage Burger,32.1120,34.8430,
Frank,32.0780,34.7750,
Bodega American Kitchen,32.0700,34.7830,
Falafel 4 Taamim,32.0850,34.7810,
Falafel Benin,32.0640,34.7720,
Sabich HaSharon,32.0650,34.7700,
Sabich Oved,32.0700,34.8050,
Hamitbahon,32.0690,34.7670,
Shimon Soup,32.0680,34.7670,
Julie Ochel,32.0685,34.7680,
HaBasta,32.0685,34.7680,
Burika Center,32.0680,34.7690,
Arepa's,32.0685,34.7690,
Viva Mexico,32.0680,34.7680,
Hummus HaSurim,32.0685,34.7675,
Hummus Abu Dabi,32.0740,34.7800,
Hummus Caspi,32.0940,34.7770,
Hummus HaBua,32.0640,34.7720,
Botanika,32.0810,34.7690,
Jasper Johns,32.0780,34.7740,
Bushwick,32.0640,34.7700,
Voodoo,32.0730,34.7790,
Fantastic,32.0960,34.7730,
Suramare,32.0650,34.7830,
Haiku Skybar,32.0630,34.7650,
Pop & Pope,32.0700,34.7840,
Radio EPGB,32.0630,34.7710,
Drama,32.0640,34.7705,
Alphabet,32.0640,34.7750,
Breakfast Club,32.0640,34.7760,
Slippers 99,32.0635,34.7710,
Nuweiba,32.0590,34.7710,
Raisa,32.0590,34.7720,
Joz ve Loz,32.0610,34.7740,
Tzlil,32.0610,34.7705,
Goodness,32.0780,34.7740,
Cafe Cucuc,32.0760,34.7740,
Beerateinu,32.0640,34.7780,
Beer Bazaar,32.0545,34.7570,
Porter & Sons,32.0700,34.7830,
Lager & Ale,32.0715,34.7870,
Norma Jean,32.0730,34.7750,
Molly Blooms,32.0780,34.7690,
Mike's Place,32.0750,34.7650,
Hazarim,32.0640,34.7710,
Gedera 26,32.0670,34.7660,
Salouf & Sons,32.0640,34.7700,
HaKovshim,32.0680,34.7660,
Itzik & Ruti,32.0620,34.7750,
Shishko,32.0650,34.7710,
George & John,32.0560,34.7590,
Popina,32.0610,34.7660,
Toto,32.0760,34.7900,
Taizu,32.0680,34.7890,
Topolopompo,32.0700,34.7890,
Zepra,32.0710,34.7920,
R48,32.0640,34.7750,
Hiba,32.0710,34.7930,
Alena,32.0660,34.7740,
Dinings,32.0660,34.7740,
Pastel,32.0770,34.7860,
Mashya,32.0780,34.7710,
Hotel Montefiore,32.0650,34.7730,
R2M Bakery,32.0830,34.7750,
Delicatessen,32.0790,34.7810,
Dallal,32.0610,34.7650,
Nordinyo,32.0700,34.7710,
Shany Bakery,32.0750,34.7800,
Roladin,32.0790,34.7810,
Biga,32.0715,34.7870,
Greg,32.0960,34.7730,
Cafe Landwer,32.0730,34.7790,
McDonalds,32.0715,34.7870,
Dominos,32.1130,34.7960,
Golda,32.1140,34.7950,
Benedict,32.0715,34.7870,
L'Entrecote,32.0640,34.7705,
Regina,32.0590,34.7620,
Haj Kahil,32.0550,34.7580,
Babylon,32.0980,34.7740,
Cafe Louise,32.1090,34.8410,
Segev Express,32.1090,34.8420,
Dixi,32.0640,34.7920,
Coffee Bar,32.0620,34.7780,
Cafe Europa,32.0650,34.7760,
The Prince,32.0590,34.7710,
Nilus,32.0660,34.7700,
K Bar,32.0640,34.7705,
Vicky Cristina,32.0590,34.7620,
Barbuniya,32.0830,34.7730,
Shtsupak,32.0960,34.7730,
Benny HaDayag,32.0970,34.7730,
Yulia,32.0970,34.7730,
Cassis,32.0400,34.7470,
Manta Ray,32.0640,34.7640,
Bezuri,32.0720,34.7720,
Cafe Michal,32.0800,34.7760,
Cafe Ann,32.0780,34.7770,
Cafe Beta,32.1120,34.7950,
Cafe Shefer,32.0670,34.7660,
Cafe Bezalel,32.0740,34.7730,
Cafe Nachmani,32.0660,34.7770,
Cafe Henrietta,32.0780,34.7850,
We Like You Too,32.0730,34.7780,
Cafe 65,32.0650,34.7760,
Grinberg,32.1250,34.7970,
206 Dagim,32.1150,34.8200,
Zuk Farm,32.1140,34.7950,
Silo,32.0800,34.7700,
Ma Pau,32.0660,34.7730,
Indira,32.0690,34.7830,
Tandoori,32.0750,34.7750,
Salam Bombay,32.0630,34.7710,
Chang Ba,32.0730,34.7750,
Long Sang,32.0650,34.7710,
Furama,32.0760,34.7720,
Amama,32.1120,34.7950,
Kanki,32.0780,34.7820,
Yan,32.0650,34.7750,
Duchan Sushi,32.0810,34.7750,
Fratelli,32.0830,34.7750,
Pizza X,32.0715,34.7870,
Pizza Grinberg,32.1250,34.7970,
Porterhouse,32.1090,34.8410,
Memphis,32.0740,34.7750,
Hummus HaCarmel,32.0685,34.7685,
Hummus HaKovshim,32.0670,34.7660,
Hummus Said,32.0540,34.7570,
Hummus Eliyahu,32.0830,34.7810,
Falafel HaKosem,32.0750,34.7760,
Falafel Ratzon,32.0740,34.7755,
Falafel Gina,32.0650,34.7830,
Sabich Tchernichovsky,32.0720,34.7720,
HaSabich Shel Oved,32.0700,34.8050,
Alegria,32.0680,34.7760,
Herzog,32.0690,34.7830,
The Green Cat,32.0620,34.7740,
Rainbow Burger,32.0770,34.7810,
Tzina,32.0750,34.7750,
Hodo,32.0670,34.7690,
Cappella,32.0700,34.7840,
Haiku,32.0630,34.7650,
Moonchild,32.0650,34.7750,
Rabbits,32.0640,34.7760,
Poupee,32.0580,34.7710,
Sura Mare,32.0650,34.7830,
Buxa,32.0630,34.7750,
Shpagat,32.0660,34.7730,
Lima Lima,32.0640,34.7760,
Layla,32.0620,34.7710,
Tbiliso,32.0590,34.7710,
Garger HaZahav,32.0590,34.7720,
The Bun,32.0680,34.7690,
Sedek,32.0650,34.7710,
Shimon,32.0680,34.7670,
Igeret BaMoshava,32.0590,34.7620,
Pundak Deluxe,32.0570,34.7580,
Cafe Yaffo,32.0540,34.7570,
Abrage,32.0540,34.7530,
Aria,32.0620,34.7710,
Winona Forever,32.0720,34.7780,
Chateaubriand,32.0810,34.7710,
Beit Kandinof,32.0540,34.7560,
Manara,32.0700,34.7660,
Ewa Safi,32.0580,34.7640,
Deca,32.0670,34.7870,
Calata 15,32.1150,34.7950,
Mezcal,32.0570,34.7730,
Gorkha Kitchen,32.0590,34.7780,
Cafe Nordoy,32.0660,34.7710,
Villa Brown,32.0660,34.7715,
Nomi,32.0640,34.7640,
Sereia,32.0640,34.7640,
Elimelech,32.0580,34.7700,
Batshon,32.0690,34.7690,
Forel,32.0580,34.7710,
Aisato,32.0830,34.7740,
Bia,32.0610,34.7720,
Ahavat Hayam,32.0710,34.7640,
Cervesiaria,32.0790,34.7710,
Christoff,32.0590,34.7720,
Gazzetta,32.0730,34.7760,
Boutique 180,32.0630,34.7640,
Cote,32.0640,34.7710,
Hino,32.0810,34.7750,
Bosser,32.0590,34.7720,
Ramesses,32.0550,34.7570,
Albi,32.0550,34.7580,
Samarkand,32.0520,34.7800,
Munn,32.0640,34.7760,
B12,32.0690,34.7830,
Lina,32.0650,34.7720,
Veranda,32.0800,34.7670,
The Common,32.0710,34.7640,
Jia,32.0720,34.7760,
Sing Long,32.0560,34.7720,
Han Man,32.0580,34.7730,
Lai Fu,32.0760,34.7750,
Giveret Kotzer,32.0540,34.7610,
Osteria Michael,32.0560,34.7610,
Cafe Geula,32.0710,34.7670,
Cafe Yalorg,32.0540,34.7580,
Mati,32.0640,34.7760,
Goat,32.0650,34.7770,
Emish,32.0620,34.7720,
La Shuk,32.0750,34.7750,
Bait Katan,32.0640,34.7710,
Giacondo,32.0620,34.7670,
Tuscania,32.0780,34.7720,
Pochela,32.0760,34.7740,
Dosa Bar,32.0810,34.7740,
2C,32.0745,34.7915,
11th Floor,32.0745,34.7915,
Hadar Ochel,32.0715,34.7870,
Library Bar,32.0660,34.7740,
Olive Leaf,32.0800,34.7670,
Ezo,32.0610,34.7720,
Kibbutz,32.0640,34.7640,
Kwantum,32.0620,34.7710,
Derby Bar,32.0970,34.7730,
Fishenzone,32.0960,34.7730,
Shames,32.0640,34.7710,
Santuari,32.0540,34.7520,
Rahel,32.0540,34.7530,
Faruk BaShuk,32.0550,34.7570,
Main Bazar,32.0550,34.7580,
Niso,32.0540,34.7570,
Acka,32.0650,34.7760,
Nami,32.0740,34.7750,
85/15,32.0680,34.7690,
Serveseria,32.0810,34.7710,
Amiram,32.0540,34.7580,
Vaniglia,32.0860,34.7820,
Cremerie De L'Eclair,32.0960,34.7730,
Mystic Pizza,32.0730,34.7750`;

// Types
interface RawRestaurant {
  name: string;
  lat: number;
  lon: number;
}

interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  city?: string;
  formatted_phone_number?: string;
  website?: string;
  price_level?: number;
  rating?: number;
  user_ratings_total?: number;
  reviews?: any[];
  photos?: any[];
  types?: string[];
  opening_hours?: any;
  geometry?: {
    location: { lat: number; lng: number };
  };
}

interface EnrichedRestaurant {
  google_place_id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  price_level: number | null;
  categories: string[];
  opening_hours: any | null;
  photos: any[];
  google_reviews: any[];
  summary: string | null;
  summary_embedding: number[] | null;
  reviews_text: string | null;
  reviews_embedding: number[] | null;
}

// Progress tracking
const PROGRESS_FILE = path.join(__dirname, 'enrichment-progress.json');

interface Progress {
  processed: string[];
  failed: string[];
  lastIndex: number;
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.log('⚠️ Could not load progress file, starting fresh');
  }
  return { processed: [], failed: [], lastIndex: 0 };
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Parse raw restaurant data
function parseRestaurants(raw: string): RawRestaurant[] {
  const lines = raw.split('\n').filter(line => line.trim());
  const restaurants: RawRestaurant[] = [];
  
  for (const line of lines) {
    // Skip header lines
    if (line.includes('Name,Lat,Lon') || line.includes('Google_Place_ID')) {
      continue;
    }
    
    const parts = line.split(',');
    if (parts.length >= 3) {
      const name = parts[0].trim();
      const lat = parseFloat(parts[1]);
      const lon = parseFloat(parts[2]);
      
      if (name && !isNaN(lat) && !isNaN(lon)) {
        restaurants.push({ name, lat, lon });
      }
    }
  }
  
  return restaurants;
}

// Deduplicate restaurants by name (case-insensitive)
function deduplicateRestaurants(restaurants: RawRestaurant[]): RawRestaurant[] {
  const seen = new Map<string, RawRestaurant>();
  
  for (const r of restaurants) {
    const key = r.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }
  
  return Array.from(seen.values());
}

// Google Places API: Find Place
async function findPlaceId(name: string, lat: number, lon: number): Promise<string | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', name + ' Tel Aviv');
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('locationbias', `circle:1000@${lat},${lon}`);
  url.searchParams.set('fields', 'place_id,name,geometry');
  url.searchParams.set('key', GOOGLE_API_KEY);
  
  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      return data.candidates[0].place_id;
    }
    
    // Try without location bias if no results
    if (data.status === 'ZERO_RESULTS') {
      url.searchParams.delete('locationbias');
      const response2 = await fetch(url.toString());
      const data2 = await response2.json();
      if (data2.status === 'OK' && data2.candidates && data2.candidates.length > 0) {
        return data2.candidates[0].place_id;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding place for ${name}:`, error);
    return null;
  }
}

// Google Places API: Get Place Details
async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'address_components',
    'geometry',
    'formatted_phone_number',
    'website',
    'price_level',
    'rating',
    'user_ratings_total',
    'reviews',
    'photos',
    'types',
    'opening_hours'
  ].join(',');
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}&reviews_sort=most_relevant&language=he`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const result = data.result;
      
      // Extract city from address_components
      let city = 'Tel Aviv';
      if (result.address_components) {
        for (const component of result.address_components) {
          if (component.types.includes('locality')) {
            city = component.long_name;
            break;
          }
        }
      }
      
      return {
        place_id: result.place_id,
        name: result.name,
        formatted_address: result.formatted_address,
        city,
        formatted_phone_number: result.formatted_phone_number,
        website: result.website,
        price_level: result.price_level,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        reviews: result.reviews?.slice(0, 5) || [],
        photos: result.photos?.slice(0, 5).map((p: any) => ({
          photo_reference: p.photo_reference,
          width: p.width,
          height: p.height
        })) || [],
        types: result.types || [],
        opening_hours: result.opening_hours,
        geometry: result.geometry
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting place details for ${placeId}:`, error);
    return null;
  }
}

// Filter and map cuisine types
function mapCuisineTypes(types: string[]): string[] {
  const relevantTypes = [
    'restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery',
    'night_club', 'food'
  ];
  
  const cuisineMap: Record<string, string> = {
    'restaurant': 'Restaurant',
    'cafe': 'Cafe',
    'bar': 'Bar',
    'bakery': 'Bakery',
    'meal_takeaway': 'Takeaway',
    'meal_delivery': 'Delivery',
    'night_club': 'Night Club',
    'food': 'Food'
  };
  
  return types
    .filter(t => relevantTypes.includes(t))
    .map(t => cuisineMap[t] || t)
    .filter((v, i, a) => a.indexOf(v) === i); // unique
}

// Detect kosher/vegetarian from reviews and types
function detectDietaryFlags(details: GooglePlaceDetails): { isKosher: boolean; isVegetarian: boolean } {
  const name = details.name.toLowerCase();
  const types = (details.types || []).join(' ').toLowerCase();
  const reviews = (details.reviews || []).map(r => (r.text || '').toLowerCase()).join(' ');
  
  const kosherKeywords = ['kosher', 'כשר', 'mehadrin', 'מהדרין', 'badatz', 'בד"צ'];
  const vegetarianKeywords = ['vegan', 'vegetarian', 'טבעוני', 'צמחוני', 'plant-based'];
  
  const allText = `${name} ${types} ${reviews}`;
  
  const isKosher = kosherKeywords.some(k => allText.includes(k));
  const isVegetarian = vegetarianKeywords.some(k => allText.includes(k));
  
  return { isKosher, isVegetarian };
}

// Generate summary using GPT-4o-mini
async function generateSummary(details: GooglePlaceDetails): Promise<string> {
  const reviewTexts = (details.reviews || [])
    .map(r => r.text)
    .filter(Boolean)
    .slice(0, 3)
    .join(' | ');
  
  const prompt = `Generate a 2-3 sentence summary in English describing this restaurant. Focus on the atmosphere, food quality, and what makes it special.

Restaurant: ${details.name}
Address: ${details.formatted_address || 'Tel Aviv'}
Type: ${(details.types || []).slice(0, 5).join(', ')}
Rating: ${details.rating || 'N/A'}/5 (${details.user_ratings_total || 0} reviews)
Price Level: ${'$'.repeat(details.price_level || 2)}
Sample Reviews: ${reviewTexts || 'No reviews available'}

Summary:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7
    });
    
    return response.choices[0]?.message?.content?.trim() || `${details.name} is a restaurant in Tel Aviv.`;
  } catch (error) {
    console.error(`Error generating summary for ${details.name}:`, error);
    return `${details.name} is a restaurant in Tel Aviv.`;
  }
}

// Generate embedding using text-embedding-3-small
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Generate reviews text for embedding
function generateReviewsText(details: GooglePlaceDetails): string {
  const reviews = details.reviews || [];
  if (reviews.length === 0) {
    return `${details.name} restaurant in Tel Aviv. ${details.types?.slice(0, 3).join(', ') || 'Restaurant'}`;
  }
  
  return reviews
    .map(r => r.text)
    .filter(Boolean)
    .join(' ')
    .slice(0, 2000); // Limit to avoid token limits
}

// Main enrichment function for a single restaurant
async function enrichRestaurant(raw: RawRestaurant): Promise<EnrichedRestaurant | null> {
  console.log(`  🔍 Finding place ID for "${raw.name}"...`);
  
  // Step 1: Find Google Place ID
  const placeId = await findPlaceId(raw.name, raw.lat, raw.lon);
  if (!placeId) {
    console.log(`  ❌ Could not find place ID for "${raw.name}"`);
    return null;
  }
  
  await sleep(100); // Rate limiting
  
  // Step 2: Get Place Details
  console.log(`  📋 Getting details for "${raw.name}"...`);
  const details = await getPlaceDetails(placeId);
  if (!details) {
    console.log(`  ❌ Could not get details for "${raw.name}"`);
    return null;
  }
  
  await sleep(100); // Rate limiting
  
  // Step 3: Generate Summary
  console.log(`  ✍️ Generating summary for "${raw.name}"...`);
  const summary = await generateSummary(details);
  
  await sleep(50); // Rate limiting
  
  // Step 4: Generate Embeddings
  console.log(`  🧠 Generating embeddings for "${raw.name}"...`);
  const summaryEmbedding = await generateEmbedding(summary);
  
  const reviewsText = generateReviewsText(details);
  const reviewsEmbedding = await generateEmbedding(reviewsText);
  
  // Step 5: Build enriched restaurant object
  const enriched: EnrichedRestaurant = {
    google_place_id: placeId,
    name: details.name,
    address: details.formatted_address || null,
    city: details.city || 'Tel Aviv',
    latitude: details.geometry?.location.lat || raw.lat,
    longitude: details.geometry?.location.lng || raw.lon,
    phone: details.formatted_phone_number || null,
    website: details.website || null,
    google_rating: details.rating || null,
    google_reviews_count: details.user_ratings_total || null,
    price_level: details.price_level || null,
    categories: mapCuisineTypes(details.types || []),
    opening_hours: details.opening_hours ? {
      periods: details.opening_hours.periods,
      weekday_text: details.opening_hours.weekday_text
    } : null,
    photos: details.photos || [],
    google_reviews: (details.reviews || []).map(r => ({
      author_name: r.author_name,
      rating: r.rating,
      text: r.text,
      time: r.time,
      relative_time_description: r.relative_time_description
    })),
    summary: summary,
    summary_embedding: summaryEmbedding,
    reviews_text: reviewsText,
    reviews_embedding: reviewsEmbedding
  };
  
  console.log(`  ✅ Enriched "${raw.name}" successfully`);
  return enriched;
}

// Insert restaurant to database
async function insertRestaurant(restaurant: EnrichedRestaurant): Promise<boolean> {
  const { error } = await supabase
    .from('restaurant_cache')
    .upsert({
      google_place_id: restaurant.google_place_id,
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      phone: restaurant.phone,
      website: restaurant.website,
      google_rating: restaurant.google_rating,
      google_reviews_count: restaurant.google_reviews_count,
      price_level: restaurant.price_level,
      categories: restaurant.categories,
      opening_hours: restaurant.opening_hours,
      photos: restaurant.photos,
      google_reviews: restaurant.google_reviews,
      summary: restaurant.summary,
      summary_embedding: restaurant.summary_embedding,
      reviews_text: restaurant.reviews_text,
      reviews_embedding: restaurant.reviews_embedding
    }, {
      onConflict: 'google_place_id'
    });
  
  if (error) {
    console.error(`Error inserting ${restaurant.name}:`, error);
    return false;
  }
  
  return true;
}

// Main function
async function main() {
  console.log('🚀 Starting Restaurant Enrichment Pipeline\n');
  
  // Step 1: Parse and deduplicate restaurants
  console.log('📖 Parsing restaurant data...');
  const rawRestaurants = parseRestaurants(RAW_RESTAURANTS);
  console.log(`   Found ${rawRestaurants.length} restaurants in raw data`);
  
  const uniqueRestaurants = deduplicateRestaurants(rawRestaurants);
  console.log(`   After deduplication: ${uniqueRestaurants.length} unique restaurants\n`);
  
  // Step 2: Delete existing restaurants
  console.log('🗑️ Deleting existing restaurants from database...');
  const { error: deleteError, count } = await supabase
    .from('restaurant_cache')
    .delete()
    .neq('google_place_id', 'impossible_value_to_delete_all'); // Delete all
  
  if (deleteError) {
    console.error('Error deleting existing restaurants:', deleteError);
    process.exit(1);
  }
  console.log(`   Deleted existing restaurants\n`);
  
  // Step 3: Load progress (for resume capability)
  const progress = loadProgress();
  console.log(`📊 Progress: ${progress.processed.length} already processed, starting from index ${progress.lastIndex}\n`);
  
  // Step 4: Process each restaurant
  let successCount = 0;
  let failCount = 0;
  
  for (let i = progress.lastIndex; i < uniqueRestaurants.length; i++) {
    const raw = uniqueRestaurants[i];
    
    // Skip already processed
    if (progress.processed.includes(raw.name.toLowerCase())) {
      continue;
    }
    
    console.log(`\n[${i + 1}/${uniqueRestaurants.length}] Processing "${raw.name}"...`);
    
    try {
      const enriched = await enrichRestaurant(raw);
      
      if (enriched) {
        const inserted = await insertRestaurant(enriched);
        if (inserted) {
          successCount++;
          progress.processed.push(raw.name.toLowerCase());
        } else {
          failCount++;
          progress.failed.push(raw.name);
        }
      } else {
        failCount++;
        progress.failed.push(raw.name);
      }
    } catch (error) {
      console.error(`Error processing ${raw.name}:`, error);
      failCount++;
      progress.failed.push(raw.name);
    }
    
    // Save progress every 10 restaurants
    if ((i + 1) % 10 === 0) {
      progress.lastIndex = i + 1;
      saveProgress(progress);
      console.log(`\n💾 Progress saved. ${successCount} successful, ${failCount} failed.\n`);
    }
    
    // Rate limiting
    await sleep(200);
  }
  
  // Final save
  progress.lastIndex = uniqueRestaurants.length;
  saveProgress(progress);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 ENRICHMENT COMPLETE');
  console.log('='.repeat(50));
  console.log(`✅ Successfully processed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📍 Total unique restaurants: ${uniqueRestaurants.length}`);
  
  if (progress.failed.length > 0) {
    console.log('\n❌ Failed restaurants:');
    progress.failed.forEach(name => console.log(`   - ${name}`));
  }
  
  // Verify database
  const { count: dbCount } = await supabase
    .from('restaurant_cache')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🗄️ Total restaurants in database: ${dbCount}`);
  console.log('\n✨ Done!');
}

// Run
main().catch(console.error);
