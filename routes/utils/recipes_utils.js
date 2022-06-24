const axios = require("axios");
const { use } = require("../user");
const dbFunctionality_utils = require("./DbFunctionality_utils");
const api_domain = "https://api.spoonacular.com/recipes";

//  Get recipes list from spoonacular response and extract the relevant recipe data for preview
async function getRecipeInformation(recipe_id) {
  return await axios.get(`${api_domain}/${recipe_id}/information`, {
    params: {
      includeNutrition: false,
      apiKey: process.env.spoonacular_apiKey,
    },
  });
}

// Accessing spoonacular for a random recipe
async function getRandomRecipiesFromSpoonacular() {
  const response = await axios.get(`${api_domain}/random`, {
    params: {
      number: 10,
      apiKey: process.env.spoonacular_apiKey,
    },
  });
  return response;
}

// Getting the recipe preview information
async function getRecipePreview(user_id, recipe_id) {
  let recipe_info = await getRecipeInformation(recipe_id);
  let is_favorite = false;
  let is_viewed = false;
  if (user_id != undefined) {
    is_favorite = await dbFunctionality_utils.isRecipeFavorite(
      user_id,
      recipe_id
    );
    is_viewed = await dbFunctionality_utils.isRecipeViewed(user_id, recipe_id);
  }
  return await createPreviewObject(
    recipe_info.data,
    is_favorite,
    is_viewed,
    false
  );
}

// Getting a personal recipe preview information
async function getRecipePreviewPersonal(recipe_id) {
  let recipe_info = await getPersonalRecipePreviewFromDB(recipe_id);
  let is_favorite = false;
  let is_viewed = true;
  return await createPreviewObject(recipe_info, is_favorite, is_viewed, true);
}

/**
 * Creating preview object
 * This function is used for personal and not personal recipes
 */
async function createPreviewObject(
  recipe_info,
  is_favorite,
  is_viewed,
  is_personal
) {
  let {
    id,
    title,
    readyInMinutes,
    image,
    aggregateLikes,
    vegan,
    vegetarian,
    glutenFree,
  } = recipe_info;

  return {
    id: id,
    title: title,
    image: image,
    readyInMinutes: readyInMinutes,
    popularity: aggregateLikes,
    vegan: vegan,
    vegetarian: vegetarian,
    glutenFree: glutenFree,
    isFavorite: is_favorite,
    isViewed: is_viewed,
    isPersonal: is_personal,
  };
}

// searching recipe
async function searchRecipes(
  user_id,
  search_term,
  cuisine,
  diet,
  intolerance,
  num_of_recipes,
  sort
) {
  if (num_of_recipes === undefined) {
    num_of_recipes = 5;
  }
  let search_pool = await getSearchSpoonacular(
    search_term,
    cuisine,
    diet,
    intolerance,
    num_of_recipes,
    sort
  );
  let recipes = search_pool.data.results;
  let selected_recipes = [];
  for (let i = 0; i < recipes.length; i++) {
    let recipe_id = recipes[i].id;
    selected_recipes.push(getRecipeDetails(user_id, recipe_id));
  }
  return await Promise.all(selected_recipes);
}

// searching spoonacular
async function getSearchSpoonacular(
  search_term,
  cuisine,
  diet,
  intolerance,
  num_of_recipes,
  sort
) {
  let request_url = `${api_domain}/complexSearch?query=${search_term}`;
  if (cuisine !== undefined) {
    request_url = request_url.concat(`&cuisine=${cuisine}`);
  }
  if (diet !== undefined) {
    request_url = request_url.concat(`&diet=${diet}`);
  }
  if (intolerance !== undefined) {
    request_url = request_url.concat(`&intolerance=${intolerance}`);
  }
  if (sort === "time") {
    request_url = request_url.concat(`&sort=time&sortDirection=asc`);
  }
  if (sort === "popularity") {
    request_url = request_url.concat(`&sort=popularity`);
  }
  const response = await axios.get(request_url, {
    params: {
      number: num_of_recipes,
      apiKey: process.env.spoonacular_apiKey,
    },
  });
  return response;
}

// get the n newest viewed recipes from a user
async function getNewestViewed(user_id, num_of_recipes) {
  recipes_id = await dbFunctionality_utils.getNewestViewedRecipes(
    user_id,
    num_of_recipes
  );
  let num_of_recipes_currenly = Math.min(num_of_recipes, recipes_id.length);
  let recipes_details = [];
  for (let i = 0; i < num_of_recipes_currenly; i++) {
    recipes_details.push(
      await getRecipePreview(user_id, recipes_id[i].recipe_id)
    );
  }
  // let info_res = await Promise.all(recipes_details);
  return recipes_details;
}

// Retrieving the wanted number of random recipes
async function getRandomRecipies(user_id, num_of_recipes) {
  let random_pool = await getRandomRecipiesFromSpoonacular();
  let recipes = random_pool.data.recipes.filter(
    (random) =>
      random.instructions != "" &&
      random.image &&
      random.image != null &&
      random.title != null
  );
  if (recipes.length < num_of_recipes) {
    getRandomRecipies(user_id, num_of_recipes);
  }
  let selected_recipes = [];
  for (let i = 0; i < num_of_recipes; i++) {
    let recipe_id = recipes[i].id;
    selected_recipes.push(getRecipePreview(user_id, recipe_id));
  }
  return await Promise.all(selected_recipes);
}

// Getting additional information about a recipe
async function getAdditionalInformation(recipe_id) {
  let recipe_info = await getRecipeInformation(recipe_id);
  let extendedIngredients = recipe_info.data.extendedIngredients;
  let analyzedInstructions = recipe_info.data.analyzedInstructions;
  let ingredientsAndQuantities = [];

  for (let ingredient of extendedIngredients) {
    let { name, amount } = ingredient;
    let unit = ingredient.measures.metric.unitLong;
    ingredientsAndQuantities.push({
      name: name,
      amount: amount,
      unit: unit,
    });
  }

  let analyzedInstructionArray = [];
  for (let analyzedInstruction of analyzedInstructions) {
    let name = analyzedInstruction.name;
    let steps = [];
    let all_steps = analyzedInstruction.steps;
    for (let specific_step of all_steps) {
      let { number, step } = specific_step;
      let ingredients = [];
      let all_ingredients = specific_step.ingredients;
      for (let ingredient of all_ingredients) {
        let name = ingredient.name;
        ingredients.push(name);
      }
      let equipments = [];
      let all_equipments = specific_step.equipment;
      for (let equipment of all_equipments) {
        let name = equipment.name;
        equipments.push(name);
      }
      steps.push({
        number: number,
        step: step,
        ingredients: ingredients,
        equipment: equipments,
      });
    }

    analyzedInstructionArray.push({
      name: name,
      steps: steps,
    });
  }

  return {
    ingredientsAndQuantities: ingredientsAndQuantities,
    analyzedInstructions: analyzedInstructionArray,
    servings: recipe_info.data.servings,
  };
}

// Getting the full recipe details by id
async function getRecipeDetails(user_id, recipe_id) {
  let first_time = true;
  if (user_id != undefined) {
    console.log("checking if first time");
    let viewed = await dbFunctionality_utils.isRecipeViewed(user_id, recipe_id);
    first_time = !viewed;
  }
  console.log("getting recipie info");
  let { ingredientsAndQuantities, analyzedInstructions, servings } =
    await getAdditionalInformation(recipe_id);
  let preview = await getRecipePreview(user_id, recipe_id);

  return {
    previewInfo: preview,
    extendedIngredients: ingredientsAndQuantities,
    analyzedInstructions: analyzedInstructions,
    servingSize: servings,
    first_time: first_time,
  };
}

// Mark recipe as viewed and return it's details
async function viewRecipe(user_id, recipe_id) {
  console.log("view recipe function for user " + user_id);
  let recipe_details = await getRecipeDetails(user_id, recipe_id);

  if (user_id != undefined) {
    await dbFunctionality_utils.viewRecipe(user_id, recipe_id);
  }

  return recipe_details;
}

// Adding new personal recipe by a user
async function addNewRecipeByUser(user_id, recipe_info) {
  let {
    title,
    image,
    readyInMinutes,
    vegan,
    vegetarian,
    glutenFree,
    servingSize,
    ingredientsAndQuantities,
    instructions,
    analyzedInstructions,
  } = recipe_info.body;
  await dbFunctionality_utils.addNewRecipeToDb(
    user_id,
    title,
    image,
    readyInMinutes,
    vegan,
    vegetarian,
    glutenFree,
    servingSize,
    ingredientsAndQuantities,
    instructions,
    analyzedInstructions
  );
}

// getting the full information about a recipe
async function getPersonalFull(recipe_id) {
  const preview = await getRecipePreviewPersonal(recipe_id);
  const additional =
    await dbFunctionality_utils.getAdditionalInformationPersonal(recipe_id);
  const ingredients = additional.ingredients;
  const instructions = additional.instructions;
  return { preview, ingredients, instructions };
}

// Getting the personal recipe preview information
async function getPersonalRecipePreviewFromDB(recipe_id) {
  let recipe = await dbFunctionality_utils.getPersonalRecipePreview(recipe_id);
  return {
    id: recipe.recipe_id,
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    popularity: 0,
    vegan: recipe.vegan === "1",
    vegetarian: recipe.vegetarian === "1",
    glutenFree: recipe.glutenFree === "1",
  };
}

// Getting all of the user's favorite recipes
async function getFavoriteRecipes(user_id) {
  let recipes = await dbFunctionality_utils.getFavoriteRecipes(user_id);
  let recipes_preview = [];
  for (let recipe of recipes) {
    if (recipe.is_personal === "0") {
      recipes_preview.push(await getRecipePreview(user_id, recipe.recipe_id));
    } else {
      recipes_preview.push(await getRecipePreviewPersonal(recipe.recipe_id));
    }
  }
  return recipes_preview;
}

// Getting all of the user's personal recipes
async function getPersonalRecipes(user_id) {
  let recipes_ids = await dbFunctionality_utils.getPersonalRecipes(user_id);
  let recipes_preview = [];
  for (let recipe of recipes_ids) {
    recipes_preview.push(await getRecipePreviewPersonal(recipe.recipe_id));
  }
  return recipes_preview;
}

/* bonus */

// getting a recipe's analyzed instruction from spoonacular
async function getAnalyzedInstructionSpoonacular(recipe_id) {
  let request_url = `${api_domain}/${recipe_id}/analyzedInstructions`;
  const response = await axios.get(request_url, {
    params: {
      apiKey: process.env.spoonacular_apiKey,
    },
  });
  let custom_elements = [];

  for (let elem in response.data) {
    let element = response.data[elem];
    let all_steps = element.steps;
    let custom_steps = [];

    // iterating over each step
    for (let i = 0; i < all_steps.length; i++) {
      let custom_equipments = [];
      let all_equipment = element.steps[i].equipment;

      for (let j = 0; j < all_equipment.length; j++) {
        let { name, image, temperature } = all_equipment[j];
        custom_equipments.push({
          name: name,
          image: image,
          temperature: temperature,
        });
      }
      let all_ingredients = element.steps[i].ingredients;
      let custom_ingredients = [];
      for (let j = 0; j < all_ingredients.length; j++) {
        let { name, image } = all_ingredients[j];
        custom_ingredients.push({
          name: name,
          image: image,
        });
      }
      let { number, step, length } = element.steps[i];
      custom_steps.push({
        number: number,
        step: step,
        ingredients: custom_ingredients,
        equipment: custom_equipments,
        length: length,
      });
    }
    let name = element.name;
    custom_elements.push({
      name: name,
      steps: custom_steps,
    });
  }
  return {
    analyzedInstructions: custom_elements,
  };
}

// getting a recipe's analyzed instruction
async function getAnalyzedInstructions(user_id, recipe_id, is_personal) {
  if (is_personal === "true") {
    return await getPersonalAnalyzedInstructions(recipe_id);
  } else {
    let full = await viewRecipe(user_id, recipe_id);
    let analyzed = getAnalyzedInstructionSpoonacular(recipe_id);
    return { full, analyzed };
  }
}

// getting the analyzed instructions for a personal recipe
async function getPersonalAnalyzedInstructions(recipe_id) {
  const fullPersonal = await getPersonalFull(recipe_id);
  const AnalyzedInstructions =
    await dbFunctionality_utils.getAnalyzedInstructionsPersonal(recipe_id);
  return { fullPersonal, AnalyzedInstructions };
}

/* bonus*/
async function addRecipeToUpcommingMeal(user_id, recipe_id, personal) {
  await dbFunctionality_utils.addRecipeToUpcommingMeal(
    user_id,
    recipe_id,
    personal
  );
  console.log(
    `recipe number ${recipe_id} was added by user ${user_id} to upcomming meal`
  );
}

async function getUpcommingMealRecipes(user_id) {
  let recipes = await dbFunctionality_utils.getRecipesUpcommingMeal(user_id);
  let recipes_preview = [];
  for (let recipe of recipes) {
    if (recipe.is_personal == 1) {
      let r = await getRecipePreviewPersonal(user_id, recipe.recipe_id);

      recipes_preview.push({ order: recipe.order_num, recipe_preview: r });
    } else {
      let r = await getRecipePreview(user_id, recipe.recipe_id);
      recipes_preview.push({ order: recipe.order_num, recipe_preview: r });
    }
  }
  return recipes_preview;
}

async function changeRecipeOrder(user_id, recipeId, neworder) {
  await dbFunctionality_utils.changeRecipeOrderInMeal(
    user_id,
    recipeId,
    neworder
  );
  console.log(
    `the order of recipe number ${recipeId} was changed to ${neworder}`
  );
}

async function getNumOfUpcommingMealRecipes(user_id) {
  let num = await dbFunctionality_utils.getOrderOfLastRecipe(user_id);
  num = num - 1;
  console.log(`num is : ${num}`);
  return num;
}

async function removeRecipeFromMeal(user_id, recipeId) {
  let num = await getNumOfUpcommingMealRecipes(user_id);
  await changeRecipeOrder(user_id, recipeId, num);
  await dbFunctionality_utils.removeRecipeFromMeal(user_id, recipeId);
}

async function removeAllRecipeFromMeal(user_id) {
  await dbFunctionality_utils.removeAllRecipesFromMeal(user_id);
}

exports.getRecipePreview = getRecipePreview;
exports.getRandomRecipies = getRandomRecipies;
exports.searchRecipes = searchRecipes;
exports.getRecipeDetails = getRecipeDetails;
exports.viewRecipe = viewRecipe;
exports.addNewRecipeByUser = addNewRecipeByUser;
exports.getFavoriteRecipes = getFavoriteRecipes;
exports.getPersonalRecipes = getPersonalRecipes;
exports.getNewestViewed = getNewestViewed;
exports.getAnalyzedInstructions = getAnalyzedInstructions;
exports.getPersonalFull = getPersonalFull;
exports.getRecipePreviewPersonal = getRecipePreviewPersonal;
exports.getPersonalAnalyzedInstructions = getPersonalAnalyzedInstructions;
exports.addRecipeToUpcommingMeal = addRecipeToUpcommingMeal;
exports.getUpcommingMealRecipes = getUpcommingMealRecipes;
exports.changeRecipeOrder = changeRecipeOrder;
exports.getNumOfUpcommingMealRecipes = getNumOfUpcommingMealRecipes;
exports.removeRecipeFromMeal = removeRecipeFromMeal;
exports.removeAllRecipeFromMeal = removeAllRecipeFromMeal;
