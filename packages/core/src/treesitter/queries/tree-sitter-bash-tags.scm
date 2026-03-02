(function_definition
  name: (word) @name.definition.function) @definition.function

(command
  name: (command_name (word) @name.reference.call)) @reference.call

(variable_assignment
  name: (variable_name) @name.definition.variable) @definition.variable

(variable_name) @name.reference.variable @reference.variable
