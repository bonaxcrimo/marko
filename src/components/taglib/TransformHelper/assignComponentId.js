'use strict';

module.exports = function assignComponentId(isRepeated) {
    // First check if we have already assigned an ID to thie element
    var componentIdInfo = this.componentIdInfo;

    if (componentIdInfo) {
        return this.componentIdInfo;
    }

    var el = this.el;
    var context = this.context;
    var builder = this.builder;

    if (el.noOutput || (el.tagDef && el.tagDef.noOutput)) {
        return;
    }

    let assignedKey;
    var nestedIdExpression;
    var idExpression;

    if (!this.hasBoundComponentForTemplate()) {
        // We are assigning a component ID to a nested component in a template that does not have a component.
        // That means we do not have access to the parent component variable as part of a closure. We
        // need to look it up out of the `out.data` map
        if (!context.isFlagSet('hasComponentVar')) {
            context.setFlag('hasComponentVar');

            var getCurrentComponentVar = context.importModule('marko_getCurrentComponent',
                this.getMarkoComponentsRequirePath('marko/components/taglib/helpers/getCurrentComponent'));

            context.addVar('__component', builder.functionCall(getCurrentComponentVar, [builder.identifierOut()]));
            context.addVar('component', builder.memberExpression(
                    builder.identifier('__component'),
                    builder.identifier('___component')));
        }
    }

    // In order to attach a DOM event listener directly we need to make sure
    // the target HTML element has an ID that we can use to get a reference
    // to the element during initialization. We generate this unique ID
    // at compile-time to allow consistent IDs during rendering.
    // We need to handle the following scenarios:
    //
    // 1) The HTML element already has an "id" attribute
    // 2) The HTML element has a "ref" or "w-id" attribute (we already converted this
    //    to an "id" attribute above)
    // 3) The HTML does not have an "id" or "ref" attribute. We must add
    //    an "id" attribute with a unique ID.

    var isHtmlElement = el.type === 'HtmlElement';
    var isCustomTag = el.type === 'CustomTag';

    // LEGACY -- Remove in Marko 5.0
    if (!isCustomTag && el.tagName === 'invoke') {
        isCustomTag = true;
    }

    if (!isCustomTag && !isHtmlElement) {
        return;
    }

    if (el.hasAttribute('w-id')) {
        context.deprecate('The "w-id" attribute is deprecated. Please use "key" instead.');

        if (el.hasAttribute('key')) {
            this.addError('The "w-id" attribute cannot be used in conjunction with the "key" attributes.');
            return;
        }

        if (el.hasAttribute('ref')) {
            this.addError('The "w-id" attribute cannot be used in conjunction with the "ref" attributes.');
            return;
        }

        assignedKey = el.getAttributeValue('w-id');

        el.removeAttribute('w-id');
    } else if (el.hasAttribute('key')) {
        assignedKey = el.getAttributeValue('key');
        el.removeAttribute('key');
    } else if (el.hasAttribute('ref')) {
        context.deprecate('The "ref" attribute is deprecated. Please use "key" instead.');
        assignedKey = el.getAttributeValue('ref');
        el.removeAttribute('ref');
    }

    if (assignedKey) {
        nestedIdExpression = assignedKey;

        if (isCustomTag) {
            idExpression = this.buildComponentElIdFunctionCall(assignedKey);
            // The element is a custom tag
            this.getComponentArgs().setKey(nestedIdExpression);
        } else {
            idExpression = assignedKey;
            if (context.data.hasLegacyForKey && el.data.userAssignedKey !== false) {
                el.setAttributeValue('id', this.buildComponentElIdFunctionCall(assignedKey));
            }

            if (context.isServerTarget()) {
                var markoKeyAttrVar = context.importModule('marko_keyAttr',
                    this.getMarkoComponentsRequirePath('marko/components/taglib/helpers/markoKeyAttr'));

                el.setAttributeValue('data-marko-key', builder.functionCall(markoKeyAttrVar, [
                        idExpression,
                        builder.identifier('__component')
                    ]));
            }

            el.setKey(assignedKey);
        }
    } else {
        // Case 3 - We need to add a unique "id" attribute
        let uniqueElId = this.nextUniqueId();

        nestedIdExpression = isRepeated ? builder.literal(uniqueElId + '[]') : builder.literal(uniqueElId.toString());

        idExpression = builder.literal(uniqueElId.toString());

        if (isCustomTag) {
            this.getComponentArgs().setKey(nestedIdExpression);
        } else {
            el.setKey(idExpression);
        }
    }

    var transformHelper = this;

    this.componentIdInfo = {
        idExpression: idExpression,
        nestedIdExpression: nestedIdExpression,
        idVarNode: null,
        createIdVarNode: function() {
            if (this.idVarNode) {
                return this.idVarNode;
            }

            let uniqueElId = transformHelper.nextUniqueId();
            let idVarName = '__key' + uniqueElId;
            let idVar = builder.identifier(idVarName);

            this.idVarNode = builder.vars([
                {
                    id: idVarName,
                    init: builder.functionCall(
                        builder.memberExpression(
                            builder.identifier('__component'),
                            builder.identifier('___nextKey')),
                        [ idExpression ])
                }
            ]);

            this.idExpression = idExpression = idVar;

            this.nestedIdExpression = nestedIdExpression = builder.concat(
                builder.literal('#'),
                idVar);

            if (isCustomTag) {
                transformHelper.getComponentArgs().setKey(nestedIdExpression);
            } else {
                el.setKey(idExpression);
            }

            return this.idVarNode;
        }
    };

    return this.componentIdInfo;
};
