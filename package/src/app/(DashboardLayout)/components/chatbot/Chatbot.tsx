import React, { useState } from "react";
import { Button, TextField } from "@mui/material";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import introJs from "intro.js";
import "intro.js/introjs.css";

// Initialize ChatOpenAI
const chatModel = new ChatOpenAI({
  openAIApiKey: "sk-proj-QnCZvH08P0YEdZBrF8r0T3BlbkFJH0RG7PZoYhXq5B5H8qJ0",
  modelName: "gpt-4o-mini",
  temperature: 0,
});

// Define the output schema
const stepSchema = z.object({
  steps: z.array(
    z.object({
      description: z.string(),
      selector: z.string(),
    })
  ),
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(stepSchema);

function getDOMStructure() {
  const structure = [];
  function traverseDOM(element, depth = 0) {
    const indent = '  '.repeat(depth);
    const classNames = Array.from(element.classList).join('.');
    const id = element.id ? `#${element.id}` : '';
    structure.push(`${indent}${element.tagName.toLowerCase()}${id}${classNames ? `.${classNames}` : ''}`);
    
    for (const child of element.children) {
      traverseDOM(child, depth + 1);
    }
  }
  traverseDOM(document.body);
  return structure.join('\n');
}

// Function to get structured steps from DOM using OpenAI API
async function getIntroJsStepsFromDOM(userQuery: string, retries = 3) {
  const domStructure = getDOMStructure();

  const prompt = `Based on the user's query and the current state of the page, generate a structured list of steps for a tutorial using Intro.js. Each step should include a description of the element and a selector to identify it on the page. Use the following DOM structure to create accurate selectors:

${domStructure}

User Query: ${userQuery}

Provide detailed and accurate steps to guide the user through the web app. Ensure that the selectors are valid and correspond to elements in the provided DOM structure.
${parser.getFormatInstructions()}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await chatModel.call([
        new SystemMessage("You are an AI assistant helping users navigate a web application."),
        new HumanMessage(prompt),
      ]);

      const parsedOutput = await parser.parse(response.content);
      return parsedOutput.steps;
    } catch (error) {
      console.error(`Error generating steps (attempt ${i + 1}):`, error);
      if (i === retries - 1) throw error;
    }
  }
}

function findSimilarElement(selector: string): Element | null {
  // Try to find elements with partial class names or IDs
  const parts = selector.split(/[.#]/);
  for (const part of parts) {
    if (part) {
      const elements = document.querySelectorAll(`[class*="${part}"], [id*="${part}"]`);
      if (elements.length > 0) {
        return elements[0];
      }
    }
  }
  return null;
}

function initializeIntroJs(steps: { description: string; selector: string }[]) {
  console.log("Initializing IntroJS with steps:", steps);
  const parsedSteps = steps
    .map((step) => {
      const element = document.querySelector(step.selector);
      if (!element) {
        console.warn(`Element not found for selector: ${step.selector}`);
        // Try to find a similar element
        const similarElement = findSimilarElement(step.selector);
        if (similarElement) {
          console.log(`Found similar element for ${step.selector}:`, similarElement);
          return { intro: step.description, element: similarElement };
        }
      }
      return { intro: step.description, element: element || undefined };
    })
    .filter((step) => step.element !== undefined);

  console.log("Parsed steps:", parsedSteps);

  if (parsedSteps.length === 0) {
    console.error("No valid steps found for the tutorial");
    return;
  }

  try {
    const tour = introJs();
    tour.setOptions({
      steps: parsedSteps,
      showStepNumbers: true,
      exitOnOverlayClick: false,
    });
    tour.start();
    console.log("Tutorial started");
  } catch (error) {
    console.error("Error starting the tutorial:", error);
  }
}

// Chatbot component
const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [generatedSteps, setGeneratedSteps] = useState<{ description: string; selector: string }[] | null>(null);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim()) {
      setMessages([...messages, { text: inputValue, sender: "user" }]);
      setInputValue("");

      try {
        // Send user query to OpenAI API
        const steps = await getIntroJsStepsFromDOM(inputValue);
        console.log("Generated steps from API:", steps);
        setGeneratedSteps(steps);

        setMessages((prevMessages) => [
          ...prevMessages,
          { text: "Tutorial generated successfully! Click 'Show Me' to start.", sender: "bot" },
        ]);
      } catch (error) {
        console.error("Error generating tutorial:", error);
        setGeneratedSteps(null);
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: "Sorry, I couldn't generate the tutorial. Please try again.", sender: "bot" },
        ]);
      }
    }
  };

  const handleShowTutorial = () => {
    console.log("Show Me button clicked");
    if (generatedSteps) {
      console.log("Generated steps:", generatedSteps);
      initializeIntroJs(generatedSteps);
    } else {
      console.log("No generated steps available");
    }
  };

  return (
    <div style={styles.chatbotContainer}>
      <Button id="toggleChat" onClick={toggleChatbot} style={styles.toggleButton}>
        {isOpen ? "Close Chat" : "Open Chat"}
      </Button>
      {isOpen && (
        <div style={styles.chatWindow}>
          <div style={styles.chatMessages}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={
                  message.sender === "user"
                    ? styles.userMessage
                    : styles.botMessage
                }
              >
                {message.text}
              </div>
            ))}
          </div>
          <div style={styles.inputContainer}>
            <TextField
              id="chatInput"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              style={styles.input}
              placeholder="Type a message..."
              variant="outlined"
              size="small"
            />
            <Button id="sendMessage" onClick={handleSendMessage} style={styles.sendButton}>
              Send
            </Button>
          </div>
          {generatedSteps && generatedSteps.length > 0 && (
            <Button id="showTutorial" onClick={handleShowTutorial} style={styles.showMeButton}>
              Show Me
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Styles for the Chatbot component
const styles = {
  chatbotContainer: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: 1000,
  },
  toggleButton: {
    backgroundColor: "#0070f3",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "5px",
    padding: "10px 20px",
    cursor: "pointer",
  },
  chatWindow: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #cccccc",
    borderRadius: "5px",
    width: "300px",
    maxHeight: "400px",
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "10px",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#0070f3",
    color: "#FFFFFF",
    padding: "5px 10px",
    borderRadius: "15px",
    margin: "5px",
    maxWidth: "80%",
    wordBreak: "break-word",
  },
  botMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#e0e0e0",
    color: "#000000",
    padding: "5px 10px",
    borderRadius: "15px",
    margin: "5px",
    maxWidth: "80%",
    wordBreak: "break-word",
  },
  inputContainer: {
    display: "flex",
    borderTop: "1px solid #cccccc",
    padding: "10px",
  },
  input: {
    flex: 1,
    marginRight: "10px",
  },
  sendButton: {
    backgroundColor: "#0070f3",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 20px",
    cursor: "pointer",
    borderRadius: "5px",
  },
  showMeButton: {
    backgroundColor: "#4caf50",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 20px",
    margin: "10px",
    cursor: "pointer",
    borderRadius: "5px",
  },
};

export default Chatbot;