'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getHintsAtPosition;

var _graphql = require('graphql');

var _introspection = require('graphql/type/introspection');

var _forEachState = require('./forEachState');

var _forEachState2 = _interopRequireDefault(_forEachState);

var _getTypeInfo = require('./getTypeInfo');

var _getTypeInfo2 = _interopRequireDefault(_getTypeInfo);

var _hintList = require('./hintList');

var _hintList2 = _interopRequireDefault(_hintList);

var _objectValues = require('./objectValues');

var _objectValues2 = _interopRequireDefault(_objectValues);

var _runParser = require('./runParser');

var _runParser2 = _interopRequireDefault(_runParser);

var _Rules = require('./Rules');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Given GraphQLSchema, sourceText, and context of the current position within
 * the source text, provide a list of typeahead entries.
 *
 * Options:
 *   - schema: GraphQLSchema
 *   - sourceText: string. A raw source text used to get fragmentDefinitions
 *                 in a source.
 *   - cursor: { line: Number, column: Number }. A current cursor position.
 *   - token: ContextToken. Includes a context for the current cursor position.
 *     Includes the token string/style (type), the start/end position, and the
 *     state at the end of the token.
 *
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function getHintsAtPosition(schema, sourceText, cursor, token) {
  // Get the current state, however if the current state is an invalid token,
  // then use the previous state to determine which hints to generate.
  var state = token.state.kind === 'Invalid' ? token.state.prevState : token.state;

  var kind = state.kind;
  var step = state.step;
  var typeInfo = (0, _getTypeInfo2.default)(schema, state);

  // Definition kinds
  if (kind === 'Document') {
    return (0, _hintList2.default)(cursor, token, [{ text: 'query' }, { text: 'mutation' }, { text: 'subscription' }, { text: 'fragment' }, { text: '{' }]);
  }

  // Field names
  if (kind === 'SelectionSet' || kind === 'Field' || kind === 'AliasedField') {
    if (typeInfo.parentType) {
      var fields = typeInfo.parentType.getFields ? (0, _objectValues2.default)(typeInfo.parentType.getFields()) : [];
      if ((0, _graphql.isAbstractType)(typeInfo.parentType)) {
        fields.push(_introspection.TypeNameMetaFieldDef);
      }
      if (typeInfo.parentType === schema.getQueryType()) {
        fields.push(_introspection.SchemaMetaFieldDef, _introspection.TypeMetaFieldDef);
      }
      return (0, _hintList2.default)(cursor, token, fields.map(function (field) {
        return {
          text: field.name,
          type: field.type,
          description: field.description,
          isDeprecated: field.isDeprecated,
          deprecationReason: field.deprecationReason
        };
      }));
    }
  }

  // Argument names
  if (kind === 'Arguments' || kind === 'Argument' && step === 0) {
    var argDefs = typeInfo.argDefs;
    if (argDefs) {
      return (0, _hintList2.default)(cursor, token, argDefs.map(function (argDef) {
        return {
          text: argDef.name,
          type: argDef.type,
          description: argDef.description
        };
      }));
    }
  }

  // Input Object fields
  if (kind === 'ObjectValue' || kind === 'ObjectField' && step === 0) {
    if (typeInfo.objectFieldDefs) {
      var objectFields = (0, _objectValues2.default)(typeInfo.objectFieldDefs);
      return (0, _hintList2.default)(cursor, token, objectFields.map(function (field) {
        return {
          text: field.name,
          type: field.type,
          description: field.description
        };
      }));
    }
  }

  // Input values: Enum and Boolean
  if (kind === 'EnumValue' || kind === 'ListValue' && step === 1 || kind === 'ObjectField' && step === 2 || kind === 'Argument' && step === 2) {
    var _ret = function () {
      var namedInputType = (0, _graphql.getNamedType)(typeInfo.inputType);
      if (namedInputType instanceof _graphql.GraphQLEnumType) {
        var valueMap = namedInputType.getValues();
        var values = (0, _objectValues2.default)(valueMap);
        return {
          v: (0, _hintList2.default)(cursor, token, values.map(function (value) {
            return {
              text: value.name,
              type: namedInputType,
              description: value.description,
              isDeprecated: value.isDeprecated,
              deprecationReason: value.deprecationReason
            };
          }))
        };
      } else if (namedInputType === _graphql.GraphQLBoolean) {
        return {
          v: (0, _hintList2.default)(cursor, token, [{ text: 'true', type: _graphql.GraphQLBoolean, description: 'Not false.' }, { text: 'false', type: _graphql.GraphQLBoolean, description: 'Not true.' }])
        };
      }
    }();

    if (typeof _ret === "object") return _ret.v;
  }

  // Fragment type conditions
  if (kind === 'TypeCondition' && step === 1 || kind === 'NamedType' && state.prevState.kind === 'TypeCondition') {
    var possibleTypes = void 0;
    if (typeInfo.parentType) {
      if ((0, _graphql.isAbstractType)(typeInfo.parentType)) {
        (function () {
          // Collect both the possible Object types as well as the interfaces
          // they implement.
          var possibleObjTypes = schema.getPossibleTypes(typeInfo.parentType);
          var possibleIfaceMap = Object.create(null);
          possibleObjTypes.forEach(function (type) {
            type.getInterfaces().forEach(function (iface) {
              possibleIfaceMap[iface.name] = iface;
            });
          });
          possibleTypes = possibleObjTypes.concat((0, _objectValues2.default)(possibleIfaceMap));
        })();
      } else {
        // The parent type is a non-abstract Object type, so the only possible
        // type that can be used is that same type.
        possibleTypes = [typeInfo.parentType];
      }
    } else {
      var typeMap = schema.getTypeMap();
      possibleTypes = (0, _objectValues2.default)(typeMap).filter(_graphql.isCompositeType);
    }
    return (0, _hintList2.default)(cursor, token, possibleTypes.map(function (type) {
      return {
        text: type.name,
        description: type.description
      };
    }));
  }

  // Fragment spread names
  if (kind === 'FragmentSpread' && step === 1) {
    var _ret3 = function () {
      var typeMap = schema.getTypeMap();
      var defState = getDefinitionState(token.state);
      var fragments = getFragmentDefinitions(sourceText);

      // Filter down to only the fragments which may exist here.
      var relevantFrags = fragments.filter(function (frag) {
        return (
          // Only include fragments with known types.
          typeMap[frag.typeCondition.name.value] &&
          // Only include fragments which are not cyclic.
          !(defState && defState.kind === 'FragmentDefinition' && defState.name === frag.name.value) &&
          // Only include fragments which could possibly be spread here.
          (0, _graphql.doTypesOverlap)(schema, typeInfo.parentType, typeMap[frag.typeCondition.name.value])
        );
      });

      return {
        v: (0, _hintList2.default)(cursor, token, relevantFrags.map(function (frag) {
          return {
            text: frag.name.value,
            type: typeMap[frag.typeCondition.name.value],
            description: 'fragment ' + frag.name.value + ' on ' + frag.typeCondition.name.value
          };
        }))
      };
    }();

    if (typeof _ret3 === "object") return _ret3.v;
  }

  // Variable definition types
  if (kind === 'VariableDefinition' && step === 2 || kind === 'ListType' && step === 1 || kind === 'NamedType' && (state.prevState.kind === 'VariableDefinition' || state.prevState.kind === 'ListType')) {
    var inputTypeMap = schema.getTypeMap();
    var inputTypes = (0, _objectValues2.default)(inputTypeMap).filter(_graphql.isInputType);
    return (0, _hintList2.default)(cursor, token, inputTypes.map(function (type) {
      return {
        text: type.name,
        description: type.description
      };
    }));
  }

  // Directive names
  if (kind === 'Directive') {
    var directives = schema.getDirectives().filter(function (directive) {
      return canUseDirective(state.prevState, directive);
    });
    return (0, _hintList2.default)(cursor, token, directives.map(function (directive) {
      return {
        text: directive.name,
        description: directive.description
      };
    }));
  }
}

function canUseDirective(state, directive) {
  var kind = state.kind;
  var locations = directive.locations;
  switch (kind) {
    // Operations
    case 'Query':
      return locations.indexOf('QUERY') !== -1;
    case 'Mutation':
      return locations.indexOf('MUTATION') !== -1;
    case 'Subscription':
      return locations.indexOf('SUBSCRIPTION') !== -1;
    case 'Field':
    case 'AliasedField':
      return locations.indexOf('FIELD') !== -1;
    case 'FragmentDefinition':
      return locations.indexOf('FRAGMENT_DEFINITION') !== -1;
    case 'FragmentSpread':
      return locations.indexOf('FRAGMENT_SPREAD') !== -1;
    case 'InlineFragment':
      return locations.indexOf('INLINE_FRAGMENT') !== -1;

    // Schema Definitions
    case 'SchemaDef':
      return locations.indexOf('SCHEMA') !== -1;
    case 'ScalarDef':
      return locations.indexOf('SCALAR') !== -1;
    case 'ObjectTypeDef':
      return locations.indexOf('OBJECT') !== -1;
    case 'FieldDef':
      return locations.indexOf('FIELD_DEFINITION') !== -1;
    case 'InterfaceDef':
      return locations.indexOf('INTERFACE') !== -1;
    case 'UnionDef':
      return locations.indexOf('UNION') !== -1;
    case 'EnumDef':
      return locations.indexOf('ENUM') !== -1;
    case 'EnumValue':
      return locations.indexOf('ENUM_VALUE') !== -1;
    case 'InputDef':
      return locations.indexOf('INPUT_OBJECT') !== -1;
    case 'InputValueDef':
      var prevStateKind = state.prevState && state.prevState.kind;
      switch (prevStateKind) {
        case 'ArgumentsDef':
          return locations.indexOf('ARGUMENT_DEFINITION') !== -1;
        case 'InputDef':
          return locations.indexOf('INPUT_FIELD_DEFINITION') !== -1;
      }
  }
  return false;
}

// Finds all fragment definition ASTs in a source.
function getFragmentDefinitions(sourceText) {
  var fragmentDefs = [];
  (0, _runParser2.default)(sourceText, {
    eatWhitespace: function eatWhitespace(stream) {
      return stream.eatWhile(_Rules.isIgnored);
    },
    LexRules: _Rules.LexRules,
    ParseRules: _Rules.ParseRules
  }, function (stream, state) {
    if (state.kind === 'FragmentDefinition' && state.name && state.type) {
      fragmentDefs.push({
        kind: 'FragmentDefinition',
        name: {
          kind: 'Name',
          value: state.name
        },
        typeCondition: {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: state.type
          }
        }
      });
    }
  });

  return fragmentDefs;
}

// Utility for returning the state representing the Definition this token state
// is within, if any.
function getDefinitionState(tokenState) {
  var definitionState = void 0;

  (0, _forEachState2.default)(tokenState, function (state) {
    switch (state.kind) {
      case 'Query':
      case 'ShortQuery':
      case 'Mutation':
      case 'Subscription':
      case 'FragmentDefinition':
        definitionState = state;
        break;
    }
  });

  return definitionState;
}