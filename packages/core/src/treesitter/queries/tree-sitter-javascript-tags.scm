(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(generator_function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (identifier) @name.definition.class) @definition.class

(variable_declarator
  name: (identifier) @name.definition.variable) @definition.variable

(call_expression
  function: (identifier) @name.reference.call) @reference.call

(member_expression
  property: (property_identifier) @name.reference.call) @reference.call
