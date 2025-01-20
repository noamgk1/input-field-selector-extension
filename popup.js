document.addEventListener("DOMContentLoaded", () => {
  const fieldNameInput = document.getElementById("field-name");
  const fieldValueInput = document.getElementById("field-value");
  const addFieldButton = document.getElementById("add-field");
  const fillFieldsButton = document.getElementById("fill-fields");
  const selectInputButton = document.getElementById("select-input");
  const fieldList = document.getElementById("field-list");
  const inputList = document.getElementById("input-list");

  let editingRow = null; // To track which row is being edited

  // Load fields from storage on startup
  function loadFields() {
    chrome.storage.local.get("fields", (result) => {
      const fields = result.fields || [];
      fields.forEach(({ name, value }) => addRow(name, value));
    });
  }

  // Save fields to storage
  function saveFields() {
    const fields = Array.from(fieldList.children).map((row) => ({
      name: row.children[0].textContent,
      value: row.children[1].textContent,
    }));
    chrome.storage.local.set({ fields });
  }

  // Update the add button text and style
  function updateAddButton() {
    if (editingRow) {
      addFieldButton.textContent = "Save";
      addFieldButton.style.backgroundColor = "green"; // Change color to green
    } else {
      addFieldButton.textContent = "Add to List";
      addFieldButton.style.backgroundColor = ""; // Reset color
    }
  }
  // Add or save field
  addFieldButton.addEventListener("click", () => {
    const fieldName = fieldNameInput.value.trim();
    const fieldValue = fieldValueInput.value.trim();

    if (!fieldName || !fieldValue) {
      alert("Field name and value cannot be empty.");
      return;
    }

    const existingNames = Array.from(fieldList.children).map(
      (row) => row.children[0].textContent
    );

    // If editing, update the row
    if (editingRow) {
      const currentName = editingRow.children[0].textContent;
      const currentValue = editingRow.children[1].textContent;

      // Check for duplicate names if the name is being changed
      if (fieldName !== currentName && existingNames.includes(fieldName)) {
        alert("This field name already exists in the list.");
        return;
      }

      // Update row only if values have changed
      if (fieldName !== currentName || fieldValue !== currentValue) {
        editingRow.children[0].textContent = fieldName;
        editingRow.children[1].textContent = fieldValue;
      }

      editingRow.classList.remove("editing"); // Remove editing class
      editingRow = null; // Reset editingRow after saving
    } else {
      // Check for duplicate field names when adding
      if (existingNames.includes(fieldName)) {
        alert("This field name already exists in the list.");
        return;
      }

      // Add a new row
      addRow(fieldName, fieldValue);
    }

    fieldNameInput.value = "";
    fieldValueInput.value = "";
    updateAddButton(); // Update button after saving or adding
    saveFields();
  });

  // Add a row to the table
  function addRow(name, value) {
    const row = document.createElement("tr");
    row.innerHTML = `
          <td>${name}</td>
          <td>${value}</td>
          <td class="actions">
            <button class="edit">Edit</button>
            <button class="delete">Delete</button>
          </td>
        `;
    fieldList.appendChild(row);

    // Add event listeners for edit and delete buttons
    const editButton = row.querySelector(".edit");
    const deleteButton = row.querySelector(".delete");

    editButton.addEventListener("click", () => editRow(row));
    deleteButton.addEventListener("click", () => deleteRow(row));
  }

  // Edit a row
  function editRow(row) {
    if (editingRow && editingRow !== row) return; // Prevent editing another row while one is being edited

    editingRow = row; // Set the row to be edited
    const nameCell = row.children[0];
    const valueCell = row.children[1];
    const name = nameCell.textContent;
    const value = valueCell.textContent;

    // Populate inputs with current values
    fieldNameInput.value = name;
    fieldValueInput.value = value;

    // Disable the row editing to prevent concurrent edits
    row.classList.add("editing");
    updateAddButton(); // Update the button when entering edit mode
    saveFields();
  }

  // Delete a row
  function deleteRow(row) {
    row.remove();
    saveFields();
  }

  // Fill fields on the active page
  fillFieldsButton.addEventListener("click", () => {
    const fields = Array.from(fieldList.children).map((row) => ({
      name: row.children[0].textContent,
      value: row.children[1].textContent,
    }));

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: fillFields,
        args: [fields],
      });
    });
  });

  // Function injected into the active page
  function fillFields(fields) {
    fields.forEach(({ name, value }) => {
      const input = document.querySelector(`[name="${name}"], #${name}`);
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  // Show available input fields in the input list
  selectInputButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: getInputFields,
        },
        (results) => {
          const inputs = results[0].result; // Get the results from the script
          showInputFields(inputs);
        }
      );
    });
  });

  // Get all input fields on the page
  function getInputFields() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="number"], input[type="password"], input[type="tel"], input[type="url"], input[type="search"], input[type="date"]'
    );
    return Array.from(inputs).map((input) => ({
      name: input.getAttribute("name") || input.id || "Unnamed Input",
    }));
  }

  // Show input fields within the popup
  function showInputFields(inputs) {
    inputList.innerHTML = ""; // Clear previous input list
    inputList.style.display = "block"; // Show the input list

    if (inputs.length === 0) {
      inputList.style.color = "red";
      inputList.textContent = "No input fields found on the page.";
      setTimeout(() => {
        inputList.style.display = "none";
      }, 3000);
    } else {
      inputs.forEach(({ name }) => {
        const listItem = document.createElement("div");
        listItem.className = "input-list-item";
        listItem.textContent = name;
        listItem.addEventListener("click", () => {
          fieldNameInput.value = name;
          inputList.style.display = "none"; // Hide the list after selection
        });
        inputList.appendChild(listItem);
      });
    }
  }

  loadFields();
});
