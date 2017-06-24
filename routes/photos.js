// .delete /photos/:id <- delete a photo if loggde in
//    and user matches of course
const express = require("express");
const router = express.Router();
const models = require("./../models");
const User = models.User;
const Photo = models.Photo;
const FileUpload = require("./../services/file-upload");

// ----------------------------------------
// Authenticate
// ----------------------------------------
router.use((req, res, next) => {
  if (!req.user) {
    res.redirect("/login");
  } else {
    next();
  }
});

// ----------------------------------------
// Index
// ----------------------------------------
router.get("/", (req, res) => {
  Photo.find()
    .populate("owner")
    .sort([["createdAt", "descending"]])
    .then(photos => {
      res.render("photos/index", { user: req.user, photos });
    })
    .catch(e => {
      if (e.errors) {
        let errors = Object.keys(e.errors);

        errors.forEach(error => {
          req.flash("error", e.errors[error].message);
        });
        res.redirect("back");
      } else {
        res.status(500).send(e.stack);
      }
    });
});

// ----------------------------------------
// New
// ----------------------------------------
router.get("/new", (req, res) => {
  res.render("photos/new", { user: req.user });
});

// ----------------------------------------
// Show
// ----------------------------------------
router.get("/:id", (req, res) => {
  let mainPhoto;
  let relatedPhotos;
  Photo.findById(req.params.id)
    .populate("owner")
    .then(results => {
      mainPhoto = results;

      return Photo.find({ owner: results.owner.id });
    })
    .then(results => {
      relatedPhotos = results;
      res.render("photos/show", { user: req.user, mainPhoto, relatedPhotos });
    });
});

// ----------------------------------------
// Create
// ----------------------------------------
const mw = FileUpload.single("photo[file]");
router.post("/", mw, (req, res, next) => {
  FileUpload.upload({
    data: req.file.buffer,
    name: req.file.originalname,
    mimetype: req.file.mimetype
  })
    .then(data => {
      let photo = new Photo({
        url: data.url,
        name: data.name,
        description: req.body.photo.description || "",
        owner: req.user.id
      });

      return photo.save();
    })
    .then(result => {
      return User.findByIdAndUpdate(req.user.id, {
        $push: { photos: result }
      });
    })
    .then(() => {
      req.flash("success", "Photo created!");
      res.redirect("/photos");
    })
    .catch(next);
});

// ----------------------------------------
// Destroy
// ----------------------------------------
router.delete("/:id", (req, res, next) => {
  let foundPhoto;
  Photo.find({ name: req.params.id })
    .then(photo => {
      foundPhoto = photo;
      if (photo[0].owner.toString() === req.user.id.toString()) {
        return FileUpload.remove(req.params.id);
      } else {
        req.flash(
          "error",
          "Error: You do not have permission to delete that photo."
        );
      }
    })
    .then(() => {
      return Photo.remove({ name: req.params.id });
    })
    .then(() => {
      return User.findByIdAndUpdate(req.user.id, {
        $pull: { photos: foundPhoto.id }
      });
    })
    .then(() => {
      res.redirect("/photos");
    })
    .catch(next);
});

module.exports = router;
