var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");

/**
 * for testing
 */
router.get("/", (req, res) => res.send("im here"));

/**
 * Getting 3 random recipes
 * Ror the Main Page
 */
router.get("/random", async (req, res, next) => {
  const user_id = req.session.user_id;
  let num_of_recipes = 3;
  try {
    let random_recipes = await recipes_utils.getRandomRecipies(
      user_id,
      num_of_recipes
    );
    res.send(random_recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Getting the 3 recipes that the user last viewed
 * For the Main Page
 */
router.get("/lastThreeViewed", async (req, res, next) => {
  const user_id = req.session.user_id;
  try {
    let last_viewed_recipes = await recipes_utils.getNewestViewed(user_id, 3);
    res.send(last_viewed_recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Getting the preview for a recipe
 * does not mark the recipe as "viewed"
 */
router.post("/preview", async (req, res, next) => {
  const user_id = req.session.user_id;
  const recipe_id = req.body.recipe_id;
  try {
    let recipe_preview = await recipes_utils.getRecipePreview(
      user_id,
      recipe_id
    );
    res.send(recipe_preview);
  } catch (error) {
    next(error);
  }
});

/** TODO- wip */
router.get("/search", async (req, res, next) => {
  let num_of_recipes = req.query.numOfResults;
  if (num_of_recipes === undefined) {
    num_of_recipes = 5;
  }
  const user_id = req.session.user_id;
  try {
    const recipe = await recipes_utils.searchRecipes(user_id, num_of_recipes);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * Returns a full details of a recipe by its id
 * TODO- check if this is the function that will be called when wanting to see a full recipie
 */
router.get("/:recipeId", async (req, res, next) => {
  const user_id = req.session.user_id;
  try {
    const recipe = await recipes_utils.viewRecipe(user_id, req.params.recipeId);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
