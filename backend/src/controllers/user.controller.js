import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import Artist from "../models/artist.model.js";

        // utility functions to generate tokens
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY });
};

          //Signup user
const signup = asyncHandler(async (req, res) => {
  // get user detail from frontend
    // validation - not empty or empty
    // check if user already exists: username, email
    // check for images, avatar
    // upload then to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { username, email, password} = req.body;

    if (!username || !email || !password) {
      throw new ApiError(400, "All fields are required");
    }

    try {
      const existingUser= await User.findOne({ email });
      if (existingUser) {
        throw new ApiError(400, "User already exists");
      }

          // create new user
      const user = new User({
        username,
        email,
        password,
      })

     
      await user.save();

      const createUser = {
        _id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role,
        show: user.show,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      res
      .status(201)
      .json(new ApiResponse(201, { user: createUser }, "User created successfully"));
    } catch (error) {
      throw new ApiError(400, error.message);
    }
})

          //Login user
const login = asyncHandler(async (req, res) => {
    
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(400, "Invalid email or password");
    }
           // compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(400, "Invalid email or password");
    }

          // generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

          // set tokens in cookie 
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === "production",  // set to true in production
      sameSite: "strict",
    });

    res
    .status(200)
    .json(new ApiResponse(200, { user, accessToken, refreshToken},"User logged in successfully"));
  } catch (error) {
    throw new ApiError(400, error.message || "Error logging in user");
  }
})

        // Update user
const updateUser = asyncHandler(async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const userId = req.user.id; // Ensure `req.user` is set by middleware
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let profileImage = user.profileImage;

  // console.log("Uploaded file:", req.file);

  if (req.file) {
    try {
      // console.log("File path:", req.file);
      
      const uploadPresponse = await uploadOnCloudinary(req.file.path);
      if (uploadPresponse && uploadPresponse.secure_url) {
        profileImage = uploadPresponse.secure_url;
      } else {
        throw new ApiError(400, "Error uplaoding image to cloudinary");
      }
    } catch (error) {
      throw new ApiError(400, error.message);
    }
  }
  

  try {
    // Check if the email is already in use by another user
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== userId) {
      throw new ApiError(400, "Email is already in use");
    }

    // Check if the username is already in use by another user
    // const existingUsername = await User.findOne({ username });
    // if (existingUsername && existingUsername._id.toString() !== userId) {
    //   throw new ApiError(400, "Username is already in use");
    // }
    const accessToken = generateAccessToken(userId);

    // Update the user's profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, email, profileImage },
      { new: true, runValidators: true } // `runValidators` ensures schema validation
    );

    if (!updatedUser) {
      throw new ApiError(404, "User not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, { user: updatedUser , accessToken }, "User updated successfully"));
  } catch (error) {
    console.error("Error updating user:", error.message);
    throw new ApiError(400, error.message);
  }
});

          // Logout user
const logout = asyncHandler(async (req, res) => {

  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",  // set to true in production
      sameSite: "strict",
    });

    res
    .status(200)
    .json(new ApiResponse(200, {}, "Logout successful"));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
})

          // update password
const updatePassword = asyncHandler(async (req, res) => {
  const { password, newPassword, confirmPassword } = req.body;

  if (!password || !newPassword || !confirmPassword) {
    throw new ApiError(400, "All fields are required");
  }

  const userId = req.user.id; // Ensure `req.user` is set by middleware

  try {
     const user = await User.findById(userId);
     if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(400, "Invalid password");
    }

    if (newPassword !== confirmPassword) {
      throw new ApiError(400, "Passwords do not match");
    }

    user.password = newPassword;
    await user.save();

    res
    .status(200)
    .json(new ApiResponse(200, { user }, "Password updated successfully"));
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
  }
})

                  // delete user
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.user.id; // Ensure `req.user` is set by middleware
  const { password } = req.body;

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ApiError(400, "Invalid password");
    }

    await User.findByIdAndDelete(userId);

    res
    .status(200)
    .json(new ApiResponse(200, {}, "User deleted successfully"));
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
  }
})

                  // Become a Artist
const createShow = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { artistName, location, bio, startDate, showPerformed, genres } = req.body;

    if (!artistName || !location || !bio || !startDate || !showPerformed || !genres) {
      throw new ApiError(400, "All fields are required");
    }

    if (req.user.role !== "artist") {
      throw new ApiError(400, "User is not an artist");
    }
    
      // Create a new artist
    const newArtist = new Artist({
      artistName, 
      location, 
      bio, 
      startDate: new Date(startDate), 
      showPerformed: parseInt(showPerformed, 10), 
      genres,
    })

      // Save the artist
    const savedArtist = await newArtist.save();

    const user = await User.findByIdAndUpdate(
      userId,
      {
        artistProfile: savedArtist._id,
      },
      { new: true }
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res
    .status(200)
    .json(new ApiResponse(200, { user }, "Show created successfully"));
  } catch (error) {
    console.error("Error creating show:", error.message);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
})

        // become a artist
const becomeArtist =  asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id; // Ensure `req.user` is set by middleware
  
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.role === "user") {
    throw new ApiError(403, "user are already a artist");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      role: "artist",
    },
    { new: true }
  );

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }
  res
  .status(200)
  .json(new ApiResponse(200, { user: updatedUser }, "User updated successfully"));
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
}) 

        // Become a User

const becomeUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByIdAndUpdate(
      userId,
      {
        role: "user",
      },
      { new: true }
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res
    .status(200)
    .json(new ApiResponse(200, { user : user }, "User updated successfully"));
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
})

        // Change email
const changeEmail = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, newEmail, password } = req.body;

    if (!email || !newEmail || !password) {
      throw new ApiError(400, "All fields are required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.email !== email) {
      throw new ApiError(400, "Invalid email");
    }

    if (!(await user.comparePassword(password))) {
      throw new ApiError(400, "Invalid password");
    }

    user.email = newEmail;
    await user.save();

    res
    .status(200)
    .json(new ApiResponse(200, { user }, "Email updated successfully"));
  } catch (error) {
    console.error("Error updating email:", error.message);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
})



export { signup, login, updateUser, logout, updatePassword, deleteUser, createShow, becomeUser, becomeArtist, changeEmail };