(function_item
  name: (identifier) @name.definition.function) @definition.function

(function_signature_item
  name: (identifier) @name.definition.function) @definition.function

(macro_definition
  name: (identifier) @name.definition.macro) @definition.macro

(struct_item
  name: (type_identifier) @name.definition.type) @definition.type

(enum_item
  name: (type_identifier) @name.definition.type) @definition.type

(trait_item
  name: (type_identifier) @name.definition.interface) @definition.interface

(mod_item
  name: (identifier) @name.definition.module) @definition.module

(call_expression
  function: [
    (identifier) @name.reference.call
    (field_expression field: (field_identifier) @name.reference.call)
    (scoped_identifier name: (identifier) @name.reference.call)
  ]) @reference.call

(generic_function
  function: [
    (identifier) @name.reference.call
    (field_expression field: (field_identifier) @name.reference.call)
    (scoped_identifier name: (identifier) @name.reference.call)
  ]) @reference.call

(macro_invocation
  macro: [
    (identifier) @name.reference.call
    (scoped_identifier name: (identifier) @name.reference.call)
  ]) @reference.call

(type_identifier) @name.reference.type @reference.type
