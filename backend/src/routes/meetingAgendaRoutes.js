const express = require("express");
const router = express.Router();
const MeetingAgenda = require("../models/MeetingAgenda");

// =====================================================
// 1. GET MEETING AGENDA BY ROOM CODE
// =====================================================
router.get("/:roomCode", async (req, res) => {
  try {
    const agenda = await MeetingAgenda.findOne({
      roomCode: req.params.roomCode,
    });

    if (!agenda) {
      return res.status(404).json({
        success: false,
        message: "Meeting agenda not found",
      });
    }

    res.status(200).json({
      success: true,
      agenda,
    });
  } catch (error) {
    console.error("Get agenda error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get meeting agenda",
      error: error.message,
    });
  }
});

// =====================================================
// 2. CREATE OR UPDATE MEETING AGENDA
// =====================================================
router.post("/", async (req, res) => {
  try {
    const { roomCode, topics, createdBy } = req.body;

    // Validation
    if (!roomCode || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "roomCode and createdBy are required",
      });
    }

    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        message: "topics must be an array",
      });
    }

    // Remove empty topics and convert strings to objects
    const formattedTopics = topics
      .filter((topic) => {
        if (typeof topic === "string") return topic.trim() !== "";
        return topic && topic.title && topic.title.trim() !== "";
      })
      .map((topic) => {
        if (typeof topic === "string") {
          return {
            title: topic.trim(),
            completed: false,
          };
        }

        return {
          title: topic.title.trim(),
          completed: topic.completed || false,
        };
      });

    // Update existing agenda or create a new one
    const agenda = await MeetingAgenda.findOneAndUpdate(
      { roomCode },
      {
        roomCode,
        topics: formattedTopics,
        createdBy,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Meeting agenda saved successfully",
      agenda,
    });
  } catch (error) {
    console.error("Create agenda error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save meeting agenda",
      error: error.message,
    });
  }
});

// =====================================================
// 3. ADD A NEW TOPIC
// =====================================================
router.post("/:roomCode/topics", async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Topic title is required",
      });
    }

    const agenda = await MeetingAgenda.findOneAndUpdate(
      { roomCode: req.params.roomCode },
      {
        $push: {
          topics: {
            title: title.trim(),
            completed: false,
          },
        },
      },
      { new: true }
    );

    if (!agenda) {
      return res.status(404).json({
        success: false,
        message: "Meeting agenda not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Topic added successfully",
      agenda,
    });
  } catch (error) {
    console.error("Add topic error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add topic",
      error: error.message,
    });
  }
});

// =====================================================
// 4. MARK A TOPIC AS COMPLETED / UNCOMPLETED
// =====================================================
router.patch("/:roomCode/topics/:topicId", async (req, res) => {
  try {
    const { completed } = req.body;

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "completed must be true or false",
      });
    }

    const agenda = await MeetingAgenda.findOneAndUpdate(
      {
        roomCode: req.params.roomCode,
        "topics._id": req.params.topicId,
      },
      {
        $set: {
          "topics.$.completed": completed,
        },
      },
      {
        new: true,
      }
    );

    if (!agenda) {
      return res.status(404).json({
        success: false,
        message: "Agenda or topic not found",
      });
    }

    res.status(200).json({
      success: true,
      message: completed
        ? "Topic marked as completed"
        : "Topic marked as pending",
      agenda,
    });
  } catch (error) {
    console.error("Update topic error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update topic",
      error: error.message,
    });
  }
});

// =====================================================
// 5. DELETE A TOPIC
// =====================================================
router.delete("/:roomCode/topics/:topicId", async (req, res) => {
  try {
    const agenda = await MeetingAgenda.findOneAndUpdate(
      {
        roomCode: req.params.roomCode,
      },
      {
        $pull: {
          topics: {
            _id: req.params.topicId,
          },
        },
      },
      {
        new: true,
      }
    );

    if (!agenda) {
      return res.status(404).json({
        success: false,
        message: "Meeting agenda not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Topic deleted successfully",
      agenda,
    });
  } catch (error) {
    console.error("Delete topic error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete topic",
      error: error.message,
    });
  }
});

module.exports = router;