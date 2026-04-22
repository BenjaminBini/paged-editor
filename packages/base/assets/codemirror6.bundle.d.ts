export var Compartment: {
    new (): {
        /**
        Create an instance of this compartment to add to your [state
        configuration](https://codemirror.net/6/docs/ref/#state.EditorStateConfig.extensions).
        */
        of(ext: any): {
            compartment: any;
            inner: any;
        };
        /**
        Create an [effect](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) that
        reconfigures this compartment.
        */
        reconfigure(content2: any): {
            type: any;
            value: any;
            /**
            Map this effect through a position mapping. Will return
            `undefined` when that ends up deleting the effect.
            */
            map(mapping: any): /*elided*/ any | undefined;
            /**
            Tells you whether this effect object is of a given
            [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
            */
            is(type: any): boolean;
        };
        /**
        Get the current content of the compartment in the state, or
        `undefined` if it isn't present.
        */
        get(state: any): any;
    };
    reconfigure: {
        map: any;
        /**
        Create a [state effect](https://codemirror.net/6/docs/ref/#state.StateEffect) instance of this
        type.
        */
        of(value: any): {
            type: any;
            value: any;
            /**
            Map this effect through a position mapping. Will return
            `undefined` when that ends up deleting the effect.
            */
            map(mapping: any): /*elided*/ any | undefined;
            /**
            Tells you whether this effect object is of a given
            [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
            */
            is(type: any): boolean;
        };
    };
};
export var EditorSelection: {
    new (ranges: any, mainIndex: any): {
        ranges: any;
        mainIndex: any;
        /**
        Map a selection through a change. Used to adjust the selection
        position for changes.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Compare this selection to another selection. By default, ranges
        are compared only by position. When `includeAssoc` is true,
        cursor ranges must also have the same
        [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Get the primary selection range. Usually, you should make sure
        your code applies to _all_ ranges, by using methods like
        [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
        */
        get main(): any;
        /**
        Make sure the selection only has one range. Returns a selection
        holding only the main range from this selection.
        */
        asSingle(): /*elided*/ any;
        /**
        Extend this selection with an extra range.
        */
        addRange(range: any, main?: boolean): /*elided*/ any;
        /**
        Replace a given range with another range, and then normalize the
        selection to merge and sort ranges if necessary.
        */
        replaceRange(range: any, which?: any): /*elided*/ any;
        /**
        Convert this selection to an object that can be serialized to
        JSON.
        */
        toJSON(): {
            ranges: any;
            main: any;
        };
    };
    /**
    Create a selection from a JSON representation.
    */
    fromJSON(json: any): {
        ranges: any;
        mainIndex: any;
        /**
        Map a selection through a change. Used to adjust the selection
        position for changes.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Compare this selection to another selection. By default, ranges
        are compared only by position. When `includeAssoc` is true,
        cursor ranges must also have the same
        [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Get the primary selection range. Usually, you should make sure
        your code applies to _all_ ranges, by using methods like
        [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
        */
        get main(): any;
        /**
        Make sure the selection only has one range. Returns a selection
        holding only the main range from this selection.
        */
        asSingle(): /*elided*/ any;
        /**
        Extend this selection with an extra range.
        */
        addRange(range: any, main?: boolean): /*elided*/ any;
        /**
        Replace a given range with another range, and then normalize the
        selection to merge and sort ranges if necessary.
        */
        replaceRange(range: any, which?: any): /*elided*/ any;
        /**
        Convert this selection to an object that can be serialized to
        JSON.
        */
        toJSON(): {
            ranges: any;
            main: any;
        };
    };
    /**
    Create a selection holding a single range.
    */
    single(anchor: any, head?: any): {
        ranges: any;
        mainIndex: any;
        /**
        Map a selection through a change. Used to adjust the selection
        position for changes.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Compare this selection to another selection. By default, ranges
        are compared only by position. When `includeAssoc` is true,
        cursor ranges must also have the same
        [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Get the primary selection range. Usually, you should make sure
        your code applies to _all_ ranges, by using methods like
        [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
        */
        get main(): any;
        /**
        Make sure the selection only has one range. Returns a selection
        holding only the main range from this selection.
        */
        asSingle(): /*elided*/ any;
        /**
        Extend this selection with an extra range.
        */
        addRange(range: any, main?: boolean): /*elided*/ any;
        /**
        Replace a given range with another range, and then normalize the
        selection to merge and sort ranges if necessary.
        */
        replaceRange(range: any, which?: any): /*elided*/ any;
        /**
        Convert this selection to an object that can be serialized to
        JSON.
        */
        toJSON(): {
            ranges: any;
            main: any;
        };
    };
    /**
    Sort and merge the given set of ranges, creating a valid
    selection.
    */
    create(ranges: any, mainIndex?: number): {
        ranges: any;
        mainIndex: any;
        /**
        Map a selection through a change. Used to adjust the selection
        position for changes.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Compare this selection to another selection. By default, ranges
        are compared only by position. When `includeAssoc` is true,
        cursor ranges must also have the same
        [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Get the primary selection range. Usually, you should make sure
        your code applies to _all_ ranges, by using methods like
        [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
        */
        get main(): any;
        /**
        Make sure the selection only has one range. Returns a selection
        holding only the main range from this selection.
        */
        asSingle(): /*elided*/ any;
        /**
        Extend this selection with an extra range.
        */
        addRange(range: any, main?: boolean): /*elided*/ any;
        /**
        Replace a given range with another range, and then normalize the
        selection to merge and sort ranges if necessary.
        */
        replaceRange(range: any, which?: any): /*elided*/ any;
        /**
        Convert this selection to an object that can be serialized to
        JSON.
        */
        toJSON(): {
            ranges: any;
            main: any;
        };
    };
    /**
    Create a cursor selection range at the given position. You can
    safely ignore the optional arguments in most situations.
    */
    cursor(pos: any, assoc: number | undefined, bidiLevel: any, goalColumn: any): {
        from: any;
        to: any;
        flags: any;
        /**
        The anchor of the range—the side that doesn't move when you
        extend it.
        */
        get anchor(): any;
        /**
        The head of the range, which is moved when the range is
        [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
        */
        get head(): any;
        /**
        True when `anchor` and `head` are at the same position.
        */
        get empty(): boolean;
        /**
        If this is a cursor that is explicitly associated with the
        character on one of its sides, this returns the side. -1 means
        the character before its position, 1 the character after, and 0
        means no association.
        */
        get assoc(): 1 | 0 | -1;
        /**
        The bidirectional text level associated with this cursor, if
        any.
        */
        get bidiLevel(): number | null;
        /**
        The goal column (stored vertical offset) associated with a
        cursor. This is used to preserve the vertical position when
        [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
        lines of different length.
        */
        get goalColumn(): number | undefined;
        /**
        Map this range through a change, producing a valid range in the
        updated document.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Extend this range to cover at least `from` to `to`.
        */
        extend(from: any, to?: any, assoc?: number): /*elided*/ any;
        /**
        Compare this range to another range.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Return a JSON-serializable object representing the range.
        */
        toJSON(): {
            anchor: any;
            head: any;
        };
    };
    /**
    Create a selection range.
    */
    range(anchor: any, head: any, goalColumn: any, bidiLevel: any, assoc: any): {
        from: any;
        to: any;
        flags: any;
        /**
        The anchor of the range—the side that doesn't move when you
        extend it.
        */
        get anchor(): any;
        /**
        The head of the range, which is moved when the range is
        [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
        */
        get head(): any;
        /**
        True when `anchor` and `head` are at the same position.
        */
        get empty(): boolean;
        /**
        If this is a cursor that is explicitly associated with the
        character on one of its sides, this returns the side. -1 means
        the character before its position, 1 the character after, and 0
        means no association.
        */
        get assoc(): 1 | 0 | -1;
        /**
        The bidirectional text level associated with this cursor, if
        any.
        */
        get bidiLevel(): number | null;
        /**
        The goal column (stored vertical offset) associated with a
        cursor. This is used to preserve the vertical position when
        [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
        lines of different length.
        */
        get goalColumn(): number | undefined;
        /**
        Map this range through a change, producing a valid range in the
        updated document.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Extend this range to cover at least `from` to `to`.
        */
        extend(from: any, to?: any, assoc?: number): /*elided*/ any;
        /**
        Compare this range to another range.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Return a JSON-serializable object representing the range.
        */
        toJSON(): {
            anchor: any;
            head: any;
        };
    };
    /**
    @internal
    */
    normalized(ranges: any, mainIndex?: number): {
        ranges: any;
        mainIndex: any;
        /**
        Map a selection through a change. Used to adjust the selection
        position for changes.
        */
        map(change: any, assoc?: number): /*elided*/ any;
        /**
        Compare this selection to another selection. By default, ranges
        are compared only by position. When `includeAssoc` is true,
        cursor ranges must also have the same
        [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
        */
        eq(other: any, includeAssoc?: boolean): boolean;
        /**
        Get the primary selection range. Usually, you should make sure
        your code applies to _all_ ranges, by using methods like
        [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
        */
        get main(): any;
        /**
        Make sure the selection only has one range. Returns a selection
        holding only the main range from this selection.
        */
        asSingle(): /*elided*/ any;
        /**
        Extend this selection with an extra range.
        */
        addRange(range: any, main?: boolean): /*elided*/ any;
        /**
        Replace a given range with another range, and then normalize the
        selection to merge and sort ranges if necessary.
        */
        replaceRange(range: any, which?: any): /*elided*/ any;
        /**
        Convert this selection to an object that can be serialized to
        JSON.
        */
        toJSON(): {
            ranges: any;
            main: any;
        };
    };
};
export var EditorState: {
    new (config: any, doc2: any, selection: any, values2: any, computeSlot: any, tr: any): {
        config: any;
        doc: any;
        selection: any;
        values: any;
        status: any;
        computeSlot: any;
        field(field: any, require2?: boolean): any;
        /**
        Create a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction) that updates this
        state. Any number of [transaction specs](https://codemirror.net/6/docs/ref/#state.TransactionSpec)
        can be passed. Unless
        [`sequential`](https://codemirror.net/6/docs/ref/#state.TransactionSpec.sequential) is set, the
        [changes](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) (if any) of each spec
        are assumed to start in the _current_ document (not the document
        produced by previous specs), and its
        [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection) and
        [effects](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) are assumed to refer
        to the document created by its _own_ changes. The resulting
        transaction contains the combined effect of all the different
        specs. For [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection), later
        specs take precedence over earlier ones.
        */
        update(...specs: any[]): any;
        /**
        @internal
        */
        applyTransaction(tr: any): void;
        /**
        Create a [transaction spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec) that
        replaces every selection range with the given content.
        */
        replaceSelection(text: any): {
            changes: any;
            selection: {
                ranges: any;
                mainIndex: any;
                /**
                Map a selection through a change. Used to adjust the selection
                position for changes.
                */
                map(change: any, assoc?: number): /*elided*/ any;
                /**
                Compare this selection to another selection. By default, ranges
                are compared only by position. When `includeAssoc` is true,
                cursor ranges must also have the same
                [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
                */
                eq(other: any, includeAssoc?: boolean): boolean;
                /**
                Get the primary selection range. Usually, you should make sure
                your code applies to _all_ ranges, by using methods like
                [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
                */
                get main(): any;
                /**
                Make sure the selection only has one range. Returns a selection
                holding only the main range from this selection.
                */
                asSingle(): /*elided*/ any;
                /**
                Extend this selection with an extra range.
                */
                addRange(range: any, main?: boolean): /*elided*/ any;
                /**
                Replace a given range with another range, and then normalize the
                selection to merge and sort ranges if necessary.
                */
                replaceRange(range: any, which?: any): /*elided*/ any;
                /**
                Convert this selection to an object that can be serialized to
                JSON.
                */
                toJSON(): {
                    ranges: any;
                    main: any;
                };
            };
            effects: any[];
        };
        /**
        Create a set of changes and a new selection by running the given
        function for each range in the active selection. The function
        can return an optional set of changes (in the coordinate space
        of the start document), plus an updated range (in the coordinate
        space of the document produced by the call's own changes). This
        method will merge all the changes and ranges into a single
        changeset and selection, and return it as a [transaction
        spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec), which can be passed to
        [`update`](https://codemirror.net/6/docs/ref/#state.EditorState.update).
        */
        changeByRange(f: any): {
            changes: any;
            selection: {
                ranges: any;
                mainIndex: any;
                /**
                Map a selection through a change. Used to adjust the selection
                position for changes.
                */
                map(change: any, assoc?: number): /*elided*/ any;
                /**
                Compare this selection to another selection. By default, ranges
                are compared only by position. When `includeAssoc` is true,
                cursor ranges must also have the same
                [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
                */
                eq(other: any, includeAssoc?: boolean): boolean;
                /**
                Get the primary selection range. Usually, you should make sure
                your code applies to _all_ ranges, by using methods like
                [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
                */
                get main(): any;
                /**
                Make sure the selection only has one range. Returns a selection
                holding only the main range from this selection.
                */
                asSingle(): /*elided*/ any;
                /**
                Extend this selection with an extra range.
                */
                addRange(range: any, main?: boolean): /*elided*/ any;
                /**
                Replace a given range with another range, and then normalize the
                selection to merge and sort ranges if necessary.
                */
                replaceRange(range: any, which?: any): /*elided*/ any;
                /**
                Convert this selection to an object that can be serialized to
                JSON.
                */
                toJSON(): {
                    ranges: any;
                    main: any;
                };
            };
            effects: any[];
        };
        /**
        Create a [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet) from the given change
        description, taking the state's document length and line
        separator into account.
        */
        changes(spec?: any[]): any;
        /**
        Using the state's [line
        separator](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator), create a
        [`Text`](https://codemirror.net/6/docs/ref/#state.Text) instance from the given string.
        */
        toText(string2: any): any;
        /**
        Return the given range of the document as a string.
        */
        sliceDoc(from?: number, to?: any): any;
        /**
        Get the value of a state [facet](https://codemirror.net/6/docs/ref/#state.Facet).
        */
        facet(facet: any): any;
        /**
        Convert this state to a JSON-serializable object. When custom
        fields should be serialized, you can pass them in as an object
        mapping property names (in the resulting object, which should
        not use `doc` or `selection`) to fields.
        */
        toJSON(fields: any): {
            doc: any;
            selection: any;
        };
        /**
        The size (in columns) of a tab in the document, determined by
        the [`tabSize`](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize) facet.
        */
        get tabSize(): any;
        /**
        Get the proper [line-break](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator)
        string for this state.
        */
        get lineBreak(): any;
        /**
        Returns true when the editor is
        [configured](https://codemirror.net/6/docs/ref/#state.EditorState^readOnly) to be read-only.
        */
        get readOnly(): any;
        /**
        Look up a translation for the given phrase (via the
        [`phrases`](https://codemirror.net/6/docs/ref/#state.EditorState^phrases) facet), or return the
        original string if no translation is found.
        
        If additional arguments are passed, they will be inserted in
        place of markers like `$1` (for the first value) and `$2`, etc.
        A single `$` is equivalent to `$1`, and `$$` will produce a
        literal dollar sign.
        */
        phrase(phrase2: any, ...insert2: any[]): any;
        /**
        Find the values for a given language data field, provided by the
        the [`languageData`](https://codemirror.net/6/docs/ref/#state.EditorState^languageData) facet.
        
        Examples of language data fields are...
        
        - [`"commentTokens"`](https://codemirror.net/6/docs/ref/#commands.CommentTokens) for specifying
          comment syntax.
        - [`"autocomplete"`](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion^config.override)
          for providing language-specific completion sources.
        - [`"wordChars"`](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) for adding
          characters that should be considered part of words in this
          language.
        - [`"closeBrackets"`](https://codemirror.net/6/docs/ref/#autocomplete.CloseBracketConfig) controls
          bracket closing behavior.
        */
        languageDataAt(name2: any, pos: any, side?: number): any[];
        /**
        Return a function that can categorize strings (expected to
        represent a single [grapheme cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak))
        into one of:
        
         - Word (contains an alphanumeric character or a character
           explicitly listed in the local language's `"wordChars"`
           language data, which should be a string)
         - Space (contains only whitespace)
         - Other (anything else)
        */
        charCategorizer(at: any): (char: any) => any;
        /**
        Find the word at the given position, meaning the range
        containing all [word](https://codemirror.net/6/docs/ref/#state.CharCategory.Word) characters
        around it. If no word characters are adjacent to the position,
        this returns null.
        */
        wordAt(pos: any): {
            from: any;
            to: any;
            flags: any;
            /**
            The anchor of the range—the side that doesn't move when you
            extend it.
            */
            get anchor(): any;
            /**
            The head of the range, which is moved when the range is
            [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
            */
            get head(): any;
            /**
            True when `anchor` and `head` are at the same position.
            */
            get empty(): boolean;
            /**
            If this is a cursor that is explicitly associated with the
            character on one of its sides, this returns the side. -1 means
            the character before its position, 1 the character after, and 0
            means no association.
            */
            get assoc(): 1 | 0 | -1;
            /**
            The bidirectional text level associated with this cursor, if
            any.
            */
            get bidiLevel(): number | null;
            /**
            The goal column (stored vertical offset) associated with a
            cursor. This is used to preserve the vertical position when
            [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
            lines of different length.
            */
            get goalColumn(): number | undefined;
            /**
            Map this range through a change, producing a valid range in the
            updated document.
            */
            map(change: any, assoc?: number): /*elided*/ any;
            /**
            Extend this range to cover at least `from` to `to`.
            */
            extend(from: any, to?: any, assoc?: number): /*elided*/ any;
            /**
            Compare this range to another range.
            */
            eq(other: any, includeAssoc?: boolean): boolean;
            /**
            Return a JSON-serializable object representing the range.
            */
            toJSON(): {
                anchor: any;
                head: any;
            };
        } | null;
    };
    /**
    Deserialize a state from its JSON representation. When custom
    fields should be deserialized, pass the same object you passed
    to [`toJSON`](https://codemirror.net/6/docs/ref/#state.EditorState.toJSON) when serializing as
    third argument.
    */
    fromJSON(json: any, config: {} | undefined, fields: any): {
        config: any;
        doc: any;
        selection: any;
        values: any;
        status: any;
        computeSlot: any;
        field(field: any, require2?: boolean): any;
        /**
        Create a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction) that updates this
        state. Any number of [transaction specs](https://codemirror.net/6/docs/ref/#state.TransactionSpec)
        can be passed. Unless
        [`sequential`](https://codemirror.net/6/docs/ref/#state.TransactionSpec.sequential) is set, the
        [changes](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) (if any) of each spec
        are assumed to start in the _current_ document (not the document
        produced by previous specs), and its
        [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection) and
        [effects](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) are assumed to refer
        to the document created by its _own_ changes. The resulting
        transaction contains the combined effect of all the different
        specs. For [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection), later
        specs take precedence over earlier ones.
        */
        update(...specs: any[]): any;
        /**
        @internal
        */
        applyTransaction(tr: any): void;
        /**
        Create a [transaction spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec) that
        replaces every selection range with the given content.
        */
        replaceSelection(text: any): {
            changes: any;
            selection: {
                ranges: any;
                mainIndex: any;
                /**
                Map a selection through a change. Used to adjust the selection
                position for changes.
                */
                map(change: any, assoc?: number): /*elided*/ any;
                /**
                Compare this selection to another selection. By default, ranges
                are compared only by position. When `includeAssoc` is true,
                cursor ranges must also have the same
                [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
                */
                eq(other: any, includeAssoc?: boolean): boolean;
                /**
                Get the primary selection range. Usually, you should make sure
                your code applies to _all_ ranges, by using methods like
                [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
                */
                get main(): any;
                /**
                Make sure the selection only has one range. Returns a selection
                holding only the main range from this selection.
                */
                asSingle(): /*elided*/ any;
                /**
                Extend this selection with an extra range.
                */
                addRange(range: any, main?: boolean): /*elided*/ any;
                /**
                Replace a given range with another range, and then normalize the
                selection to merge and sort ranges if necessary.
                */
                replaceRange(range: any, which?: any): /*elided*/ any;
                /**
                Convert this selection to an object that can be serialized to
                JSON.
                */
                toJSON(): {
                    ranges: any;
                    main: any;
                };
            };
            effects: any[];
        };
        /**
        Create a set of changes and a new selection by running the given
        function for each range in the active selection. The function
        can return an optional set of changes (in the coordinate space
        of the start document), plus an updated range (in the coordinate
        space of the document produced by the call's own changes). This
        method will merge all the changes and ranges into a single
        changeset and selection, and return it as a [transaction
        spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec), which can be passed to
        [`update`](https://codemirror.net/6/docs/ref/#state.EditorState.update).
        */
        changeByRange(f: any): {
            changes: any;
            selection: {
                ranges: any;
                mainIndex: any;
                /**
                Map a selection through a change. Used to adjust the selection
                position for changes.
                */
                map(change: any, assoc?: number): /*elided*/ any;
                /**
                Compare this selection to another selection. By default, ranges
                are compared only by position. When `includeAssoc` is true,
                cursor ranges must also have the same
                [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
                */
                eq(other: any, includeAssoc?: boolean): boolean;
                /**
                Get the primary selection range. Usually, you should make sure
                your code applies to _all_ ranges, by using methods like
                [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
                */
                get main(): any;
                /**
                Make sure the selection only has one range. Returns a selection
                holding only the main range from this selection.
                */
                asSingle(): /*elided*/ any;
                /**
                Extend this selection with an extra range.
                */
                addRange(range: any, main?: boolean): /*elided*/ any;
                /**
                Replace a given range with another range, and then normalize the
                selection to merge and sort ranges if necessary.
                */
                replaceRange(range: any, which?: any): /*elided*/ any;
                /**
                Convert this selection to an object that can be serialized to
                JSON.
                */
                toJSON(): {
                    ranges: any;
                    main: any;
                };
            };
            effects: any[];
        };
        /**
        Create a [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet) from the given change
        description, taking the state's document length and line
        separator into account.
        */
        changes(spec?: any[]): any;
        /**
        Using the state's [line
        separator](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator), create a
        [`Text`](https://codemirror.net/6/docs/ref/#state.Text) instance from the given string.
        */
        toText(string2: any): any;
        /**
        Return the given range of the document as a string.
        */
        sliceDoc(from?: number, to?: any): any;
        /**
        Get the value of a state [facet](https://codemirror.net/6/docs/ref/#state.Facet).
        */
        facet(facet: any): any;
        /**
        Convert this state to a JSON-serializable object. When custom
        fields should be serialized, you can pass them in as an object
        mapping property names (in the resulting object, which should
        not use `doc` or `selection`) to fields.
        */
        toJSON(fields: any): {
            doc: any;
            selection: any;
        };
        /**
        The size (in columns) of a tab in the document, determined by
        the [`tabSize`](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize) facet.
        */
        get tabSize(): any;
        /**
        Get the proper [line-break](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator)
        string for this state.
        */
        get lineBreak(): any;
        /**
        Returns true when the editor is
        [configured](https://codemirror.net/6/docs/ref/#state.EditorState^readOnly) to be read-only.
        */
        get readOnly(): any;
        /**
        Look up a translation for the given phrase (via the
        [`phrases`](https://codemirror.net/6/docs/ref/#state.EditorState^phrases) facet), or return the
        original string if no translation is found.
        
        If additional arguments are passed, they will be inserted in
        place of markers like `$1` (for the first value) and `$2`, etc.
        A single `$` is equivalent to `$1`, and `$$` will produce a
        literal dollar sign.
        */
        phrase(phrase2: any, ...insert2: any[]): any;
        /**
        Find the values for a given language data field, provided by the
        the [`languageData`](https://codemirror.net/6/docs/ref/#state.EditorState^languageData) facet.
        
        Examples of language data fields are...
        
        - [`"commentTokens"`](https://codemirror.net/6/docs/ref/#commands.CommentTokens) for specifying
          comment syntax.
        - [`"autocomplete"`](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion^config.override)
          for providing language-specific completion sources.
        - [`"wordChars"`](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) for adding
          characters that should be considered part of words in this
          language.
        - [`"closeBrackets"`](https://codemirror.net/6/docs/ref/#autocomplete.CloseBracketConfig) controls
          bracket closing behavior.
        */
        languageDataAt(name2: any, pos: any, side?: number): any[];
        /**
        Return a function that can categorize strings (expected to
        represent a single [grapheme cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak))
        into one of:
        
         - Word (contains an alphanumeric character or a character
           explicitly listed in the local language's `"wordChars"`
           language data, which should be a string)
         - Space (contains only whitespace)
         - Other (anything else)
        */
        charCategorizer(at: any): (char: any) => any;
        /**
        Find the word at the given position, meaning the range
        containing all [word](https://codemirror.net/6/docs/ref/#state.CharCategory.Word) characters
        around it. If no word characters are adjacent to the position,
        this returns null.
        */
        wordAt(pos: any): {
            from: any;
            to: any;
            flags: any;
            /**
            The anchor of the range—the side that doesn't move when you
            extend it.
            */
            get anchor(): any;
            /**
            The head of the range, which is moved when the range is
            [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
            */
            get head(): any;
            /**
            True when `anchor` and `head` are at the same position.
            */
            get empty(): boolean;
            /**
            If this is a cursor that is explicitly associated with the
            character on one of its sides, this returns the side. -1 means
            the character before its position, 1 the character after, and 0
            means no association.
            */
            get assoc(): 1 | 0 | -1;
            /**
            The bidirectional text level associated with this cursor, if
            any.
            */
            get bidiLevel(): number | null;
            /**
            The goal column (stored vertical offset) associated with a
            cursor. This is used to preserve the vertical position when
            [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
            lines of different length.
            */
            get goalColumn(): number | undefined;
            /**
            Map this range through a change, producing a valid range in the
            updated document.
            */
            map(change: any, assoc?: number): /*elided*/ any;
            /**
            Extend this range to cover at least `from` to `to`.
            */
            extend(from: any, to?: any, assoc?: number): /*elided*/ any;
            /**
            Compare this range to another range.
            */
            eq(other: any, includeAssoc?: boolean): boolean;
            /**
            Return a JSON-serializable object representing the range.
            */
            toJSON(): {
                anchor: any;
                head: any;
            };
        } | null;
    };
    /**
    Create a new state. You'll usually only need this when
    initializing an editor—updated states are created by applying
    transactions.
    */
    create(config?: {}): {
        config: any;
        doc: any;
        selection: any;
        values: any;
        status: any;
        computeSlot: any;
        field(field: any, require2?: boolean): any;
        /**
        Create a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction) that updates this
        state. Any number of [transaction specs](https://codemirror.net/6/docs/ref/#state.TransactionSpec)
        can be passed. Unless
        [`sequential`](https://codemirror.net/6/docs/ref/#state.TransactionSpec.sequential) is set, the
        [changes](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) (if any) of each spec
        are assumed to start in the _current_ document (not the document
        produced by previous specs), and its
        [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection) and
        [effects](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) are assumed to refer
        to the document created by its _own_ changes. The resulting
        transaction contains the combined effect of all the different
        specs. For [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection), later
        specs take precedence over earlier ones.
        */
        update(...specs: any[]): any;
        /**
        @internal
        */
        applyTransaction(tr: any): void;
        /**
        Create a [transaction spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec) that
        replaces every selection range with the given content.
        */
        replaceSelection(text: any): {
            changes: any;
            selection: {
                ranges: any;
                mainIndex: any;
                /**
                Map a selection through a change. Used to adjust the selection
                position for changes.
                */
                map(change: any, assoc?: number): /*elided*/ any;
                /**
                Compare this selection to another selection. By default, ranges
                are compared only by position. When `includeAssoc` is true,
                cursor ranges must also have the same
                [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
                */
                eq(other: any, includeAssoc?: boolean): boolean;
                /**
                Get the primary selection range. Usually, you should make sure
                your code applies to _all_ ranges, by using methods like
                [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
                */
                get main(): any;
                /**
                Make sure the selection only has one range. Returns a selection
                holding only the main range from this selection.
                */
                asSingle(): /*elided*/ any;
                /**
                Extend this selection with an extra range.
                */
                addRange(range: any, main?: boolean): /*elided*/ any;
                /**
                Replace a given range with another range, and then normalize the
                selection to merge and sort ranges if necessary.
                */
                replaceRange(range: any, which?: any): /*elided*/ any;
                /**
                Convert this selection to an object that can be serialized to
                JSON.
                */
                toJSON(): {
                    ranges: any;
                    main: any;
                };
            };
            effects: any[];
        };
        /**
        Create a set of changes and a new selection by running the given
        function for each range in the active selection. The function
        can return an optional set of changes (in the coordinate space
        of the start document), plus an updated range (in the coordinate
        space of the document produced by the call's own changes). This
        method will merge all the changes and ranges into a single
        changeset and selection, and return it as a [transaction
        spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec), which can be passed to
        [`update`](https://codemirror.net/6/docs/ref/#state.EditorState.update).
        */
        changeByRange(f: any): {
            changes: any;
            selection: {
                ranges: any;
                mainIndex: any;
                /**
                Map a selection through a change. Used to adjust the selection
                position for changes.
                */
                map(change: any, assoc?: number): /*elided*/ any;
                /**
                Compare this selection to another selection. By default, ranges
                are compared only by position. When `includeAssoc` is true,
                cursor ranges must also have the same
                [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
                */
                eq(other: any, includeAssoc?: boolean): boolean;
                /**
                Get the primary selection range. Usually, you should make sure
                your code applies to _all_ ranges, by using methods like
                [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
                */
                get main(): any;
                /**
                Make sure the selection only has one range. Returns a selection
                holding only the main range from this selection.
                */
                asSingle(): /*elided*/ any;
                /**
                Extend this selection with an extra range.
                */
                addRange(range: any, main?: boolean): /*elided*/ any;
                /**
                Replace a given range with another range, and then normalize the
                selection to merge and sort ranges if necessary.
                */
                replaceRange(range: any, which?: any): /*elided*/ any;
                /**
                Convert this selection to an object that can be serialized to
                JSON.
                */
                toJSON(): {
                    ranges: any;
                    main: any;
                };
            };
            effects: any[];
        };
        /**
        Create a [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet) from the given change
        description, taking the state's document length and line
        separator into account.
        */
        changes(spec?: any[]): any;
        /**
        Using the state's [line
        separator](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator), create a
        [`Text`](https://codemirror.net/6/docs/ref/#state.Text) instance from the given string.
        */
        toText(string2: any): any;
        /**
        Return the given range of the document as a string.
        */
        sliceDoc(from?: number, to?: any): any;
        /**
        Get the value of a state [facet](https://codemirror.net/6/docs/ref/#state.Facet).
        */
        facet(facet: any): any;
        /**
        Convert this state to a JSON-serializable object. When custom
        fields should be serialized, you can pass them in as an object
        mapping property names (in the resulting object, which should
        not use `doc` or `selection`) to fields.
        */
        toJSON(fields: any): {
            doc: any;
            selection: any;
        };
        /**
        The size (in columns) of a tab in the document, determined by
        the [`tabSize`](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize) facet.
        */
        get tabSize(): any;
        /**
        Get the proper [line-break](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator)
        string for this state.
        */
        get lineBreak(): any;
        /**
        Returns true when the editor is
        [configured](https://codemirror.net/6/docs/ref/#state.EditorState^readOnly) to be read-only.
        */
        get readOnly(): any;
        /**
        Look up a translation for the given phrase (via the
        [`phrases`](https://codemirror.net/6/docs/ref/#state.EditorState^phrases) facet), or return the
        original string if no translation is found.
        
        If additional arguments are passed, they will be inserted in
        place of markers like `$1` (for the first value) and `$2`, etc.
        A single `$` is equivalent to `$1`, and `$$` will produce a
        literal dollar sign.
        */
        phrase(phrase2: any, ...insert2: any[]): any;
        /**
        Find the values for a given language data field, provided by the
        the [`languageData`](https://codemirror.net/6/docs/ref/#state.EditorState^languageData) facet.
        
        Examples of language data fields are...
        
        - [`"commentTokens"`](https://codemirror.net/6/docs/ref/#commands.CommentTokens) for specifying
          comment syntax.
        - [`"autocomplete"`](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion^config.override)
          for providing language-specific completion sources.
        - [`"wordChars"`](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) for adding
          characters that should be considered part of words in this
          language.
        - [`"closeBrackets"`](https://codemirror.net/6/docs/ref/#autocomplete.CloseBracketConfig) controls
          bracket closing behavior.
        */
        languageDataAt(name2: any, pos: any, side?: number): any[];
        /**
        Return a function that can categorize strings (expected to
        represent a single [grapheme cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak))
        into one of:
        
         - Word (contains an alphanumeric character or a character
           explicitly listed in the local language's `"wordChars"`
           language data, which should be a string)
         - Space (contains only whitespace)
         - Other (anything else)
        */
        charCategorizer(at: any): (char: any) => any;
        /**
        Find the word at the given position, meaning the range
        containing all [word](https://codemirror.net/6/docs/ref/#state.CharCategory.Word) characters
        around it. If no word characters are adjacent to the position,
        this returns null.
        */
        wordAt(pos: any): {
            from: any;
            to: any;
            flags: any;
            /**
            The anchor of the range—the side that doesn't move when you
            extend it.
            */
            get anchor(): any;
            /**
            The head of the range, which is moved when the range is
            [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
            */
            get head(): any;
            /**
            True when `anchor` and `head` are at the same position.
            */
            get empty(): boolean;
            /**
            If this is a cursor that is explicitly associated with the
            character on one of its sides, this returns the side. -1 means
            the character before its position, 1 the character after, and 0
            means no association.
            */
            get assoc(): 1 | 0 | -1;
            /**
            The bidirectional text level associated with this cursor, if
            any.
            */
            get bidiLevel(): number | null;
            /**
            The goal column (stored vertical offset) associated with a
            cursor. This is used to preserve the vertical position when
            [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
            lines of different length.
            */
            get goalColumn(): number | undefined;
            /**
            Map this range through a change, producing a valid range in the
            updated document.
            */
            map(change: any, assoc?: number): /*elided*/ any;
            /**
            Extend this range to cover at least `from` to `to`.
            */
            extend(from: any, to?: any, assoc?: number): /*elided*/ any;
            /**
            Compare this range to another range.
            */
            eq(other: any, includeAssoc?: boolean): boolean;
            /**
            Return a JSON-serializable object representing the range.
            */
            toJSON(): {
                anchor: any;
                head: any;
            };
        } | null;
    };
    allowMultipleSelections: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    tabSize: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    lineSeparator: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    readOnly: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    phrases: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    languageData: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    changeFilter: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    transactionFilter: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    transactionExtender: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
};
export var EditorView: {
    new (config?: {}): {
        /**
        The current editor state.
        */
        get state(): any;
        /**
        To be able to display large documents without consuming too much
        memory or overloading the browser, CodeMirror only draws the
        code that is visible (plus a margin around it) to the DOM. This
        property tells you the extent of the current drawn viewport, in
        document positions.
        */
        get viewport(): {
            from: any;
            to: any;
        } | undefined;
        /**
        When there are, for example, large collapsed ranges in the
        viewport, its size can be a lot bigger than the actual visible
        content. Thus, if you are doing something like styling the
        content in the viewport, it is preferable to only do so for
        these ranges, which are the subset of the viewport that is
        actually drawn.
        */
        get visibleRanges(): any[];
        /**
        Returns false when the editor is entirely scrolled out of view
        or otherwise hidden.
        */
        get inView(): boolean;
        /**
        Indicates whether the user is currently composing text via
        [IME](https://en.wikipedia.org/wiki/Input_method), and at least
        one change has been made in the current composition.
        */
        get composing(): boolean;
        /**
        Indicates whether the user is currently in composing state. Note
        that on some platforms, like Android, this will be the case a
        lot, since just putting the cursor on a word starts a
        composition there.
        */
        get compositionStarted(): boolean;
        /**
        The document or shadow root that the view lives in.
        */
        readonly root: any;
        /**
        @internal
        */
        get win(): Window & typeof globalThis;
        plugins: any;
        pluginMap: Map<any, any>;
        editorAttrs: {};
        contentAttrs: {};
        bidiCache: any[];
        destroyed: boolean;
        updateState: number;
        measureScheduled: number;
        measureRequests: any[];
        contentDOM: HTMLDivElement;
        scrollDOM: HTMLDivElement;
        announceDOM: HTMLDivElement;
        dom: HTMLDivElement;
        dispatchTransactions: any;
        dispatch(...input: any[]): void;
        _root: any;
        viewState: {
            view: any;
            state: any;
            pixelViewport: {
                left: number;
                right: number;
                top: number;
                bottom: number;
            };
            inView: boolean;
            paddingTop: number;
            paddingBottom: number;
            contentDOMWidth: number;
            contentDOMHeight: number;
            editorHeight: number;
            editorWidth: number;
            scaleX: number;
            scaleY: number;
            scrollOffset: number;
            scrolledToBottom: boolean;
            scrollAnchorPos: number;
            scrollAnchorHeight: number;
            scaler: {
                toDOM(n: any): any;
                fromDOM(n: any): any;
                scale: number;
                eq(other: any): boolean;
            };
            scrollTarget: any;
            printing: boolean;
            mustMeasureContent: boolean;
            defaultTextDirection: any;
            visibleRanges: any[];
            mustEnforceCursorAssoc: boolean;
            heightOracle: {
                lineWrapping: any;
                doc: {
                    text: any;
                    length: number;
                    get lines(): any;
                    get children(): null;
                    lineInner(target: any, isLine: any, line: any, offset: any): {
                        from: any;
                        to: any;
                        number: any;
                        text: any;
                        /**
                        The length of the line (not including any line break after it).
                        */
                        get length(): number;
                    };
                    decompose(from: any, to: any, target: any, open: any): void;
                    replace(from: any, to: any, text: any): any;
                    sliceString(from: any, to?: number, lineSep?: string): string;
                    flatten(target: any): void;
                    scanIdentical(): number;
                    /**
                    Get the line description around the given position.
                    */
                    lineAt(pos: any): any;
                    /**
                    Get the description for the given (1-based) line number.
                    */
                    line(n: any): any;
                    /**
                    Append another document to this one.
                    */
                    append(other: any): any;
                    /**
                    Retrieve the text between the given points.
                    */
                    slice(from: any, to?: any): any;
                    /**
                    Test whether this text is equal to another instance.
                    */
                    eq(other: any): boolean;
                    /**
                    Iterate over the text. When `dir` is `-1`, iteration happens
                    from end to start. This will return lines and the breaks between
                    them as separate strings.
                    */
                    iter(dir?: number): {
                        dir: number;
                        done: boolean;
                        lineBreak: boolean;
                        value: string;
                        nodes: any[];
                        offsets: number[];
                        nextInner(skip: any, dir: any): /*elided*/ any;
                        next(skip?: number): /*elided*/ any;
                    };
                    /**
                    Iterate over a range of the text. When `from` > `to`, the
                    iterator will run in reverse.
                    */
                    iterRange(from: any, to?: any): {
                        value: string;
                        done: boolean;
                        cursor: {
                            dir: number;
                            done: boolean;
                            lineBreak: boolean;
                            value: string;
                            nodes: any[];
                            offsets: number[];
                            nextInner(skip: any, dir: any): /*elided*/ any;
                            next(skip?: number): /*elided*/ any;
                        };
                        pos: any;
                        from: number;
                        to: number;
                        nextInner(skip: any, dir: any): /*elided*/ any;
                        next(skip?: number): /*elided*/ any;
                        get lineBreak(): boolean;
                    };
                    /**
                    Return a cursor that iterates over the given range of lines,
                    _without_ returning the line breaks between, and yielding empty
                    strings for empty lines.
                    
                    When `from` and `to` are given, they should be 1-based line numbers.
                    */
                    iterLines(from: any, to: any): {
                        inner: any;
                        afterBreak: boolean;
                        value: string;
                        done: boolean;
                        next(skip?: number): /*elided*/ any;
                        get lineBreak(): boolean;
                    };
                    /**
                    Return the document as a string, using newline characters to
                    separate lines.
                    */
                    toString(): any;
                    /**
                    Convert the document to an array of lines (which can be
                    deserialized again via [`Text.of`](https://codemirror.net/6/docs/ref/#state.Text^of)).
                    */
                    toJSON(): any[];
                };
                heightSamples: {};
                lineHeight: number;
                charWidth: number;
                textHeight: number;
                lineLength: number;
                heightForGap(from: any, to: any): number;
                heightForLine(length: any): number;
                setDoc(doc2: any): /*elided*/ any;
                mustRefreshForWrapping(whiteSpace: any): boolean;
                mustRefreshForHeights(lineHeights: any): boolean;
                refresh(whiteSpace: any, lineHeight: any, charWidth: any, textHeight: any, lineLength: any, knownHeights: any): boolean;
            };
            stateDeco: any;
            heightMap: any;
            viewport: {
                from: any;
                to: any;
            } | undefined;
            lineGaps: any[];
            lineGapDeco: any;
            scrollParent: any;
            updateForViewport(): 0 | 2;
            viewports: ({
                from: any;
                to: any;
            } | undefined)[] | undefined;
            updateScaler(): 0 | 2;
            updateViewportLines(): void;
            viewportLines: any[] | undefined;
            update(update: any, scrollTarget?: null): void;
            measure(): number;
            get visibleTop(): any;
            get visibleBottom(): any;
            getViewport(bias: any, scrollTarget: any): {
                from: any;
                to: any;
            };
            mapViewport(viewport: any, changes: any): {
                from: any;
                to: any;
            };
            viewportIsAppropriate({ from, to }: {
                from: any;
                to: any;
            }, bias?: number): boolean;
            mapLineGaps(gaps: any, changes: any): any;
            ensureLineGaps(current: any, mayMeasure: any): any[];
            gapSize(line: any, from: any, to: any, structure: any): number;
            updateLineGaps(gaps: any): void;
            computeVisibleRanges(changes: any): number;
            lineBlockAt(pos: any): any;
            lineBlockAtHeight(height: any): any;
            getScrollOffset(): number;
            scrollAnchorAt(scrollOffset: any): any;
            elementAtHeight(height: any): any;
            get docHeight(): any;
            get contentHeight(): any;
        };
        observer: {
            view: any;
            active: boolean;
            editContext: {
                from: number;
                to: number;
                pendingContextChange: {
                    from: any;
                    to: any;
                    insert: any;
                } | null;
                handlers: any;
                composing: any;
                editContext: any;
                measureReq: {
                    read: (view2: any) => void;
                };
                applyEdits(update: any): boolean;
                update(update: any): void;
                resetRange(state: any): void;
                reset(state: any): void;
                revertPending(state: any): void;
                setSelection(state: any): void;
                rangeIsValid(state: any): boolean;
                toEditorPos(contextPos: any, clipLen?: number): any;
                toContextPos(editorPos: any): any;
                destroy(): void;
            } | null;
            selectionRange: {
                anchorNode: any;
                anchorOffset: number;
                focusNode: any;
                focusOffset: number;
                eq(domSel: any): boolean;
                setRange(range: any): void;
                set(anchorNode: any, anchorOffset: any, focusNode: any, focusOffset: any): void;
            };
            selectionChanged: boolean;
            delayedFlush: number;
            resizeTimeout: number;
            queue: any[];
            delayedAndroidKey: any;
            flushingAndroidKey: number;
            lastChange: number;
            scrollTargets: any[];
            intersection: IntersectionObserver | null;
            resizeScroll: ResizeObserver | null;
            intersecting: boolean;
            gapIntersection: IntersectionObserver | null;
            gaps: any[];
            printQuery: MediaQueryList | null;
            parentCheck: number;
            dom: any;
            observer: MutationObserver;
            onCharData: ((event: any) => void) | undefined;
            onSelectionChange(event: any): void;
            onResize(): void;
            onPrint(event: any): void;
            onScroll(e: any): void;
            win: any;
            onScrollChanged(e: any): void;
            updateGaps(gaps: any): void;
            readSelectionRange(): boolean;
            setSelectionRange(anchor: any, head: any): void;
            clearSelectionRange(): void;
            listenForScroll(): void;
            ignore(f: any): any;
            start(): void;
            stop(): void;
            clear(): void;
            delayAndroidKey(key: any, keyCode: any): void;
            clearDelayedAndroidKey(): void;
            flushSoon(): void;
            forceFlush(): void;
            pendingRecords(): any[];
            processRecords(): {
                from: number;
                to: number;
                typeOver: boolean;
            };
            readChange(): {
                typeOver: any;
                bounds: {
                    from: any;
                    to: any;
                    startDOM: any;
                    endDOM: any;
                } | null;
                text: string;
                domChanged: boolean;
                newSel: any;
            } | null;
            flush(readSelection?: boolean): boolean;
            readMutation(rec: any): {
                from: any;
                to: any;
                typeOver: boolean;
            } | null;
            setWindow(win: any): void;
            addWindowListeners(win: any): void;
            removeWindowListeners(win: any): void;
            update(update: any): void;
            destroy(): void;
        };
        inputState: {
            setSelectionOrigin(origin: any): void;
            lastSelectionOrigin: any;
            lastSelectionTime: number;
            view: any;
            lastKeyCode: number;
            lastKeyTime: number;
            lastTouchTime: number;
            lastTouchX: number;
            lastTouchY: number;
            lastFocusTime: number;
            lastScrollTop: number;
            lastScrollLeft: number;
            lastWheelEvent: number;
            tabFocusMode: number;
            lastContextMenu: number;
            scrollHandlers: any[];
            handlers: any;
            composing: number;
            compositionFirstChange: any;
            compositionEndedAt: number;
            compositionPendingKey: boolean;
            compositionPendingChange: boolean;
            insertingText: string;
            insertingTextAt: number;
            mouseSelection: any;
            draggedContent: any;
            handleEvent(event: any): void;
            notifiedFocused: any;
            runHandlers(type: any, event: any): void;
            ensureHandlers(plugins: any): void;
            keydown(event: any): boolean;
            pendingIOSKey: any;
            flushIOSKey(change: any): boolean;
            ignoreDuringComposition(event: any): boolean;
            startMouseSelection(mouseSelection: any): void;
            update(update: any): void;
            destroy(): void;
        };
        docView: {
            view: any;
            decorations: any[];
            blockWrappers: any[];
            dynamicDecorationMap: boolean[];
            domChanged: any;
            hasComposition: {
                from: any;
                to: any;
            } | null;
            editContextFormatting: {
                chunkPos: any;
                chunk: any;
                nextLayer: any;
                maxPoint: any;
                /**
                @internal
                */
                get length(): number;
                /**
                The number of ranges in the set.
                */
                get size(): any;
                /**
                @internal
                */
                chunkEnd(index: any): any;
                /**
                Update the range set, optionally adding new ranges or filtering
                out existing ones.
                
                (Note: The type parameter is just there as a kludge to work
                around TypeScript variance issues that prevented `RangeSet<X>`
                from being a subtype of `RangeSet<Y>` when `X` is a subtype of
                `Y`.)
                */
                update(updateSpec: any): any;
                /**
                Map this range set through a set of changes, return the new set.
                */
                map(changes: any): any;
                /**
                Iterate over the ranges that touch the region `from` to `to`,
                calling `f` for each. There is no guarantee that the ranges will
                be reported in any specific order. When the callback returns
                `false`, iteration stops.
                */
                between(from: any, to: any, f: any): void;
                /**
                Iterate over the ranges in this set, in order, including all
                ranges that end at or after `from`.
                */
                iter(from?: number): {
                    layer: any;
                    skip: any;
                    minPoint: any;
                    rank: number;
                    readonly startSide: any;
                    readonly endSide: any;
                    goto(pos: any, side?: number): /*elided*/ any;
                    chunkIndex: number | undefined;
                    rangeIndex: any;
                    gotoInner(pos: any, side: any, forward: any): void;
                    forward(pos: any, side: any): void;
                    next(): void;
                    from: any;
                    to: any;
                    value: any;
                    setRangeIndex(index: any): void;
                    nextChunk(): void;
                    compare(other: any): number;
                } | {
                    heap: any;
                    get startSide(): any;
                    goto(pos: any, side?: number): /*elided*/ any;
                    forward(pos: any, side: any): void;
                    next(): void;
                    from: any;
                    to: any;
                    value: any;
                    rank: any;
                };
                /**
                @internal
                */
                get isEmpty(): boolean;
            };
            lastCompositionAfterCursor: boolean;
            minWidth: number;
            minWidthFrom: number;
            minWidthTo: number;
            impreciseAnchor: {
                node: any;
                offset: any;
                precise: boolean;
            } | null;
            impreciseHead: {
                node: any;
                offset: any;
                precise: boolean;
            } | null;
            forceSelection: boolean;
            lastUpdate: number;
            tile: {
                view: any;
                owns(tile: any): boolean;
                isBlock(): boolean;
                nearest(dom: any): any;
                blockTiles(f: any): any;
                resolveBlock(pos: any, side: any): {
                    tile: undefined;
                    offset: number;
                };
                _children: any[];
                isComposite(): boolean;
                get children(): any[];
                get lastChild(): any;
                append(child: any): void;
                sync(track: any): void;
                length: any;
                dom: any;
                flags: number;
                parent: any;
                get breakAfter(): number;
                isWidget(): boolean;
                get isHidden(): boolean;
                isLine(): boolean;
                isText(): boolean;
                get domAttrs(): null;
                toString(): string;
                destroy(): void;
                setDOM(dom: any): void;
                get posAtStart(): any;
                get posAtEnd(): any;
                posBefore(tile: any, start?: any): any;
                posAfter(tile: any): any;
                covers(side: any): boolean;
                coordsIn(pos: any, side: any): null;
                domPosFor(off: any, side: any): {
                    node: any;
                    offset: any;
                    precise: boolean;
                };
                markDirty(attrs: any): void;
                get overrideDOMText(): null;
                readonly root: any;
            };
            update(update: any): boolean;
            updateInner(changes: any, composition: any): void;
            updateEditContextFormatting(update: any): void;
            updateSelection(mustRead?: boolean, fromPointer?: boolean): void;
            suppressWidgetCursorChange(sel: any, cursor: any): any;
            enforceCursorAssoc(): void;
            posFromDOM(node: any, offset: any): any;
            domAtPos(pos: any, side: any): any;
            inlineDOMNearPos(pos: any, side: any): any;
            coordsAt(pos: any, side: any): any;
            lineAt(pos: any, side: any): null | undefined;
            coordsForChar(pos: any): any;
            measureVisibleLineHeights(viewport: any): any[];
            textDirectionAt(pos: any): any;
            measureTextSize(): any;
            computeBlockGapDeco(): any;
            updateDeco(): void;
            scrollIntoView(target: any): true | undefined;
            lineHasWidget(pos: any): any;
            destroy(): void;
        };
        /**
        Update the view for the given array of transactions. This will
        update the visible document and selection to match the state
        produced by the transactions, and notify view plugins of the
        change. You should usually call
        [`dispatch`](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch) instead, which uses this
        as a primitive.
        */
        update(transactions: any): void;
        /**
        Reset the view to the given state. (This will cause the entire
        document to be redrawn and all view plugins to be reinitialized,
        so you should probably only use it when the new state isn't
        derived from the old state. Otherwise, use
        [`dispatch`](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch) instead.)
        */
        setState(newState: any): void;
        updatePlugins(update: any): void;
        docViewUpdate(): void;
        /**
        @internal
        */
        measure(flush?: boolean): void;
        /**
        Get the CSS classes for the currently active editor themes.
        */
        get themeClasses(): string;
        updateAttrs(): any;
        showAnnouncements(trs: any): void;
        mountStyles(): void;
        styleModules: any;
        readMeasured(): void;
        /**
        Schedule a layout measurement, optionally providing callbacks to
        do custom DOM measuring followed by a DOM write phase. Using
        this is preferable reading DOM layout directly from, for
        example, an event handler, because it'll make sure measuring and
        drawing done by other components is synchronized, avoiding
        unnecessary DOM layout computations.
        */
        requestMeasure(request: any): void;
        /**
        Get the value of a specific plugin, if present. Note that
        plugins that crash can be dropped from a view, so even when you
        know you registered a given plugin, it is recommended to check
        the return value of this method.
        */
        plugin(plugin: any): any;
        /**
        The top position of the document, in screen coordinates. This
        may be negative when the editor is scrolled down. Points
        directly to the top of the first line, not above the padding.
        */
        get documentTop(): number;
        /**
        Reports the padding above and below the document.
        */
        get documentPadding(): {
            top: number;
            bottom: number;
        };
        /**
        If the editor is transformed with CSS, this provides the scale
        along the X axis. Otherwise, it will just be 1. Note that
        transforms other than translation and scaling are not supported.
        */
        get scaleX(): number;
        /**
        Provide the CSS transformed scale along the Y axis.
        */
        get scaleY(): number;
        /**
        Find the text line or block widget at the given vertical
        position (which is interpreted as relative to the [top of the
        document](https://codemirror.net/6/docs/ref/#view.EditorView.documentTop)).
        */
        elementAtHeight(height: any): any;
        /**
        Find the line block (see
        [`lineBlockAt`](https://codemirror.net/6/docs/ref/#view.EditorView.lineBlockAt)) at the given
        height, again interpreted relative to the [top of the
        document](https://codemirror.net/6/docs/ref/#view.EditorView.documentTop).
        */
        lineBlockAtHeight(height: any): any;
        /**
        Get the extent and vertical position of all [line
        blocks](https://codemirror.net/6/docs/ref/#view.EditorView.lineBlockAt) in the viewport. Positions
        are relative to the [top of the
        document](https://codemirror.net/6/docs/ref/#view.EditorView.documentTop);
        */
        get viewportLineBlocks(): any[] | undefined;
        /**
        Find the line block around the given document position. A line
        block is a range delimited on both sides by either a
        non-[hidden](https://codemirror.net/6/docs/ref/#view.Decoration^replace) line break, or the
        start/end of the document. It will usually just hold a line of
        text, but may be broken into multiple textblocks by block
        widgets.
        */
        lineBlockAt(pos: any): any;
        /**
        The editor's total content height.
        */
        get contentHeight(): any;
        /**
        Move a cursor position by [grapheme
        cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak). `forward` determines whether
        the motion is away from the line start, or towards it. In
        bidirectional text, the line is traversed in visual order, using
        the editor's [text direction](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection).
        When the start position was the last one on the line, the
        returned position will be across the line break. If there is no
        further line, the original position is returned.
        
        By default, this method moves over a single cluster. The
        optional `by` argument can be used to move across more. It will
        be called with the first cluster as argument, and should return
        a predicate that determines, for each subsequent cluster,
        whether it should also be moved over.
        */
        moveByChar(start: any, forward: any, by: any): any;
        /**
        Move a cursor position across the next group of either
        [letters](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) or non-letter
        non-whitespace characters.
        */
        moveByGroup(start: any, forward: any): any;
        /**
        Get the cursor position visually at the start or end of a line.
        Note that this may differ from the _logical_ position at its
        start or end (which is simply at `line.from`/`line.to`) if text
        at the start or end goes against the line's base text direction.
        */
        visualLineSide(line: any, end: any): {
            from: any;
            to: any;
            flags: any;
            /**
            The anchor of the range—the side that doesn't move when you
            extend it.
            */
            get anchor(): any;
            /**
            The head of the range, which is moved when the range is
            [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
            */
            get head(): any;
            /**
            True when `anchor` and `head` are at the same position.
            */
            get empty(): boolean;
            /**
            If this is a cursor that is explicitly associated with the
            character on one of its sides, this returns the side. -1 means
            the character before its position, 1 the character after, and 0
            means no association.
            */
            get assoc(): 1 | 0 | -1;
            /**
            The bidirectional text level associated with this cursor, if
            any.
            */
            get bidiLevel(): number | null;
            /**
            The goal column (stored vertical offset) associated with a
            cursor. This is used to preserve the vertical position when
            [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
            lines of different length.
            */
            get goalColumn(): number | undefined;
            /**
            Map this range through a change, producing a valid range in the
            updated document.
            */
            map(change: any, assoc?: number): /*elided*/ any;
            /**
            Extend this range to cover at least `from` to `to`.
            */
            extend(from: any, to?: any, assoc?: number): /*elided*/ any;
            /**
            Compare this range to another range.
            */
            eq(other: any, includeAssoc?: boolean): boolean;
            /**
            Return a JSON-serializable object representing the range.
            */
            toJSON(): {
                anchor: any;
                head: any;
            };
        };
        /**
        Move to the next line boundary in the given direction. If
        `includeWrap` is true, line wrapping is on, and there is a
        further wrap point on the current line, the wrap point will be
        returned. Otherwise this function will return the start or end
        of the line.
        */
        moveToLineBoundary(start: any, forward: any, includeWrap?: boolean): {
            from: any;
            to: any;
            flags: any;
            /**
            The anchor of the range—the side that doesn't move when you
            extend it.
            */
            get anchor(): any;
            /**
            The head of the range, which is moved when the range is
            [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
            */
            get head(): any;
            /**
            True when `anchor` and `head` are at the same position.
            */
            get empty(): boolean;
            /**
            If this is a cursor that is explicitly associated with the
            character on one of its sides, this returns the side. -1 means
            the character before its position, 1 the character after, and 0
            means no association.
            */
            get assoc(): 1 | 0 | -1;
            /**
            The bidirectional text level associated with this cursor, if
            any.
            */
            get bidiLevel(): number | null;
            /**
            The goal column (stored vertical offset) associated with a
            cursor. This is used to preserve the vertical position when
            [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
            lines of different length.
            */
            get goalColumn(): number | undefined;
            /**
            Map this range through a change, producing a valid range in the
            updated document.
            */
            map(change: any, assoc?: number): /*elided*/ any;
            /**
            Extend this range to cover at least `from` to `to`.
            */
            extend(from: any, to?: any, assoc?: number): /*elided*/ any;
            /**
            Compare this range to another range.
            */
            eq(other: any, includeAssoc?: boolean): boolean;
            /**
            Return a JSON-serializable object representing the range.
            */
            toJSON(): {
                anchor: any;
                head: any;
            };
        };
        /**
        Move a cursor position vertically. When `distance` isn't given,
        it defaults to moving to the next line (including wrapped
        lines). Otherwise, `distance` should provide a positive distance
        in pixels.
        
        When `start` has a
        [`goalColumn`](https://codemirror.net/6/docs/ref/#state.SelectionRange.goalColumn), the vertical
        motion will use that as a target horizontal position. Otherwise,
        the cursor's own horizontal position is used. The returned
        cursor will have its goal column set to whichever column was
        used.
        */
        moveVertically(start: any, forward: any, distance: any): any;
        /**
        Find the DOM parent node and offset (child offset if `node` is
        an element, character offset when it is a text node) at the
        given document position.
        
        Note that for positions that aren't currently in
        `visibleRanges`, the resulting DOM position isn't necessarily
        meaningful (it may just point before or after a placeholder
        element).
        */
        domAtPos(pos: any, side?: number): any;
        /**
        Find the document position at the given DOM node. Can be useful
        for associating positions with DOM events. Will raise an error
        when `node` isn't part of the editor content.
        */
        posAtDOM(node: any, offset?: number): any;
        posAtCoords(coords: any, precise?: boolean): any;
        posAndSideAtCoords(coords: any, precise?: boolean): any;
        /**
        Get the screen coordinates at the given document position.
        `side` determines whether the coordinates are based on the
        element before (-1) or after (1) the position (if no element is
        available on the given side, the method will transparently use
        another strategy to get reasonable coordinates).
        */
        coordsAtPos(pos: any, side?: number): any;
        /**
        Return the rectangle around a given character. If `pos` does not
        point in front of a character that is in the viewport and
        rendered (i.e. not replaced, not a line break), this will return
        null. For space characters that are a line wrap point, this will
        return the position before the line break.
        */
        coordsForChar(pos: any): any;
        /**
        The default width of a character in the editor. May not
        accurately reflect the width of all characters (given variable
        width fonts or styling of invididual ranges).
        */
        get defaultCharacterWidth(): number;
        /**
        The default height of a line in the editor. May not be accurate
        for all lines.
        */
        get defaultLineHeight(): number;
        /**
        The text direction
        ([`direction`](https://developer.mozilla.org/en-US/docs/Web/CSS/direction)
        CSS property) of the editor's content element.
        */
        get textDirection(): any;
        /**
        Find the text direction of the block at the given position, as
        assigned by CSS. If
        [`perLineTextDirection`](https://codemirror.net/6/docs/ref/#view.EditorView^perLineTextDirection)
        isn't enabled, or the given position is outside of the viewport,
        this will always return the same as
        [`textDirection`](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection). Note that
        this may trigger a DOM layout.
        */
        textDirectionAt(pos: any): any;
        /**
        Whether this editor [wraps lines](https://codemirror.net/6/docs/ref/#view.EditorView.lineWrapping)
        (as determined by the
        [`white-space`](https://developer.mozilla.org/en-US/docs/Web/CSS/white-space)
        CSS property of its content element).
        */
        get lineWrapping(): any;
        /**
        Returns the bidirectional text structure of the given line
        (which should be in the current document) as an array of span
        objects. The order of these spans matches the [text
        direction](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection)—if that is
        left-to-right, the leftmost spans come first, otherwise the
        rightmost spans come first.
        */
        bidiSpans(line: any): any;
        /**
        Check whether the editor has focus.
        */
        get hasFocus(): boolean;
        /**
        Put focus on the editor.
        */
        focus(): void;
        /**
        Update the [root](https://codemirror.net/6/docs/ref/##view.EditorViewConfig.root) in which the editor lives. This is only
        necessary when moving the editor's existing DOM to a new window or shadow root.
        */
        setRoot(root: any): void;
        /**
        Clean up this editor view, removing its element from the
        document, unregistering event handlers, and notifying
        plugins. The view instance can no longer be used after
        calling this.
        */
        destroy(): void;
        /**
        Return an effect that resets the editor to its current (at the
        time this method was called) scroll position. Note that this
        only affects the editor's own scrollable element, not parents.
        See also
        [`EditorViewConfig.scrollTo`](https://codemirror.net/6/docs/ref/#view.EditorViewConfig.scrollTo).
        
        The effect should be used with a document identical to the one
        it was created for. Failing to do so is not an error, but may
        not scroll to the expected position. You can
        [map](https://codemirror.net/6/docs/ref/#state.StateEffect.map) the effect to account for changes.
        */
        scrollSnapshot(): {
            type: any;
            value: any;
            /**
            Map this effect through a position mapping. Will return
            `undefined` when that ends up deleting the effect.
            */
            map(mapping: any): /*elided*/ any | undefined;
            /**
            Tells you whether this effect object is of a given
            [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
            */
            is(type: any): boolean;
        };
        /**
        Enable or disable tab-focus mode, which disables key bindings
        for Tab and Shift-Tab, letting the browser's default
        focus-changing behavior go through instead. This is useful to
        prevent trapping keyboard users in your editor.
        
        Without argument, this toggles the mode. With a boolean, it
        enables (true) or disables it (false). Given a number, it
        temporarily enables the mode until that number of milliseconds
        have passed or another non-Tab key is pressed.
        */
        setTabFocusMode(to: any): void;
    };
    /**
    Returns an effect that can be
    [added](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) to a transaction to
    cause it to scroll the given position or range into view.
    */
    scrollIntoView(pos: any, options?: {}): {
        type: any;
        value: any;
        /**
        Map this effect through a position mapping. Will return
        `undefined` when that ends up deleting the effect.
        */
        map(mapping: any): /*elided*/ any | undefined;
        /**
        Tells you whether this effect object is of a given
        [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
        */
        is(type: any): boolean;
    };
    /**
    Returns an extension that can be used to add DOM event handlers.
    The value should be an object mapping event names to handler
    functions. For any given event, such functions are ordered by
    extension precedence, and the first handler to return true will
    be assumed to have handled that event, and no other handlers or
    built-in behavior will be activated for it. These are registered
    on the [content element](https://codemirror.net/6/docs/ref/#view.EditorView.contentDOM), except
    for `scroll` handlers, which will be called any time the
    editor's [scroll element](https://codemirror.net/6/docs/ref/#view.EditorView.scrollDOM) or one of
    its parent nodes is scrolled.
    */
    domEventHandlers(handlers2: any): {
        id: any;
        create: any;
        domEventHandlers: any;
        domEventObservers: any;
        baseExtensions: any;
        extension: any;
        /**
        Create an extension for this plugin with the given argument.
        */
        of(arg: any): any;
    };
    /**
    Create an extension that registers DOM event observers. Contrary
    to event [handlers](https://codemirror.net/6/docs/ref/#view.EditorView^domEventHandlers),
    observers can't be prevented from running by a higher-precedence
    handler returning true. They also don't prevent other handlers
    and observers from running when they return true, and should not
    call `preventDefault`.
    */
    domEventObservers(observers2: any): {
        id: any;
        create: any;
        domEventHandlers: any;
        domEventObservers: any;
        baseExtensions: any;
        extension: any;
        /**
        Create an extension for this plugin with the given argument.
        */
        of(arg: any): any;
    };
    /**
    Create a theme extension. The first argument can be a
    [`style-mod`](https://github.com/marijnh/style-mod#documentation)
    style spec providing the styles for the theme. These will be
    prefixed with a generated class for the style.
    
    Because the selectors will be prefixed with a scope class, rule
    that directly match the editor's [wrapper
    element](https://codemirror.net/6/docs/ref/#view.EditorView.dom)—to which the scope class will be
    added—need to be explicitly differentiated by adding an `&` to
    the selector for that element—for example
    `&.cm-focused`.
    
    When `dark` is set to true, the theme will be marked as dark,
    which will cause the `&dark` rules from [base
    themes](https://codemirror.net/6/docs/ref/#view.EditorView^baseTheme) to be used (as opposed to
    `&light` when a light theme is active).
    */
    theme(spec: any, options: any): {
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    }[];
    /**
    Create an extension that adds styles to the base theme. Like
    with [`theme`](https://codemirror.net/6/docs/ref/#view.EditorView^theme), use `&` to indicate the
    place of the editor wrapper element when directly targeting
    that. You can also use `&dark` or `&light` instead to only
    target editors with a dark or light theme.
    */
    baseTheme(spec: any): {
        inner: any;
        prec: any;
    };
    /**
    Retrieve an editor view instance from the view's DOM
    representation.
    */
    findFromDOM(dom: any): any;
    styleModule: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    inputHandler: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    clipboardInputFilter: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    clipboardOutputFilter: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    scrollHandler: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    focusChangeEffect: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    perLineTextDirection: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    exceptionSink: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    updateListener: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    editable: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    mouseSelectionStyle: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    dragMovesSelection: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    clickAddsSelectionRange: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    decorations: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    blockWrappers: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    outerDecorations: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    atomicRanges: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    bidiIsolatedRanges: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    cursorScrollMargin: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    scrollMargins: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    darkTheme: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    cspNonce: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    contentAttributes: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    editorAttributes: {
        combine: any;
        compareInput: any;
        compare: any;
        isStatic: any;
        id: number;
        default: any;
        extensions: any;
        /**
        Returns a facet reader for this facet, which can be used to
        [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
        */
        get reader(): /*elided*/ any;
        /**
        Returns an extension that adds the given value to this facet.
        */
        of(value: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes a value for the facet from a
        state. You must take care to declare the parts of the state that
        this value depends on, since your function is only called again
        for a new state when one of those parts changed.
        
        In cases where your value depends only on a single field, you'll
        want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
        */
        compute(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        /**
        Create an extension that computes zero or more values for this
        facet from a state.
        */
        computeN(deps: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
        from(field: any, get: any): {
            dependencies: any;
            facet: any;
            type: any;
            value: any;
            id: number;
            dynamicSlot(addresses: any): {
                create(state: any): number;
                update(state: any, tr: any): 1 | 0;
                reconfigure: (state: any, oldState: any) => 1 | 0;
            };
        };
    };
    lineWrapping: {
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    };
    announce: {
        map: any;
        /**
        Create a [state effect](https://codemirror.net/6/docs/ref/#state.StateEffect) instance of this
        type.
        */
        of(value: any): {
            type: any;
            value: any;
            /**
            Map this effect through a position mapping. Will return
            `undefined` when that ends up deleting the effect.
            */
            map(mapping: any): /*elided*/ any | undefined;
            /**
            Tells you whether this effect object is of a given
            [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
            */
            is(type: any): boolean;
        };
    };
};
export var HighlightStyle: {
    new (specs: any, options: any): {
        specs: any;
        scope: ((type: any) => boolean) | undefined;
        style: (tags4: any) => any;
        module: {
            rules: any[];
            getRules(): string;
        } | null;
        themeType: any;
    };
    /**
    Create a highlighter style that associates the given styles to
    the given tags. The specs must be objects that hold a style tag
    or array of tags in their `tag` property, and either a single
    `class` property providing a static CSS class (for highlighter
    that rely on external styling), or a
    [`style-mod`](https://github.com/marijnh/style-mod#documentation)-style
    set of CSS properties (which define the styling for those tags).
    
    The CSS rules created for a highlighter will be emitted in the
    order of the spec's properties. That means that for elements that
    have multiple tags associated with them, styles defined further
    down in the list will have a higher CSS precedence than styles
    defined earlier.
    */
    define(specs: any, options?: any): {
        specs: any;
        scope: ((type: any) => boolean) | undefined;
        style: (tags4: any) => any;
        module: {
            rules: any[];
            getRules(): string;
        } | null;
        themeType: any;
    };
};
export var LanguageDescription: {
    new (name2: any, alias: any, extensions: any, filename: any, loadFunc: any, support?: undefined): {
        name: any;
        alias: any;
        extensions: any;
        filename: any;
        loadFunc: any;
        support: any;
        loading: any;
        /**
        Start loading the the language. Will return a promise that
        resolves to a [`LanguageSupport`](https://codemirror.net/6/docs/ref/#language.LanguageSupport)
        object when the language successfully loads.
        */
        load(): any;
    };
    /**
    Create a language description.
    */
    of(spec: any): {
        name: any;
        alias: any;
        extensions: any;
        filename: any;
        loadFunc: any;
        support: any;
        loading: any;
        /**
        Start loading the the language. Will return a promise that
        resolves to a [`LanguageSupport`](https://codemirror.net/6/docs/ref/#language.LanguageSupport)
        object when the language successfully loads.
        */
        load(): any;
    };
    /**
    Look for a language in the given array of descriptions that
    matches the filename. Will first match
    [`filename`](https://codemirror.net/6/docs/ref/#language.LanguageDescription.filename) patterns,
    and then [extensions](https://codemirror.net/6/docs/ref/#language.LanguageDescription.extensions),
    and return the first language that matches.
    */
    matchFilename(descs: any, filename: any): any;
    /**
    Look for a language whose name or alias matches the the given
    name (case-insensitively). If `fuzzy` is true, and no direct
    matchs is found, this'll also search for a language whose name
    or alias occurs in the string (for names shorter than three
    characters, only when surrounded by non-word characters).
    */
    matchLanguageName(descs: any, name2: any, fuzzy?: boolean): any;
};
export function crosshairCursor(options?: {}): ({
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
} | {
    id: any;
    create: any;
    domEventHandlers: any;
    domEventObservers: any;
    baseExtensions: any;
    extension: any;
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: any): any;
})[];
export function css(): {
    language: any;
    support: any[];
    extension: any[];
};
export var defaultHighlightStyle: {
    specs: any;
    scope: ((type: any) => boolean) | undefined;
    style: (tags4: any) => any;
    module: {
        rules: any[];
        getRules(): string;
    } | null;
    themeType: any;
};
export var defaultKeymap: ({
    key: string;
    mac: string;
    run: (view: any) => boolean;
    shift: (view: any) => boolean;
    preventDefault?: undefined;
} | {
    key: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    mac?: undefined;
    shift?: undefined;
    preventDefault?: undefined;
} | {
    key: string;
    mac: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    shift?: undefined;
    preventDefault?: undefined;
} | {
    key: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    preventDefault: boolean;
    mac?: undefined;
    shift?: undefined;
})[];
export function drawSelection(config?: {}): ({
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
} | {
    inner: any;
    prec: any;
} | ({
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
} | {
    id: any;
    create: any;
    domEventHandlers: any;
    domEventObservers: any;
    baseExtensions: any;
    extension: any;
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: any): any;
})[])[];
export function dropCursor(): ({
    id: any;
    createF: any;
    updateF: any;
    compareF: any;
    spec: any;
    create(state: any): any;
    /**
    @internal
    */
    slot(addresses: any): {
        create: (state: any) => number;
        update: (state: any, tr: any) => 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
    /**
    Returns an extension that enables this field and overrides the
    way it is initialized. Can be useful when you need to provide a
    non-default starting value for the field.
    */
    init(create: any): ({
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    } | /*elided*/ any)[];
    /**
    State field instances can be used as
    [`Extension`](https://codemirror.net/6/docs/ref/#state.Extension) values to enable the field in a
    given state.
    */
    get extension(): /*elided*/ any;
} | {
    id: any;
    create: any;
    domEventHandlers: any;
    domEventObservers: any;
    baseExtensions: any;
    extension: any;
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: any): any;
})[];
export function highlightActiveLine(): {
    id: any;
    create: any;
    domEventHandlers: any;
    domEventObservers: any;
    baseExtensions: any;
    extension: any;
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: any): any;
};
export function highlightActiveLineGutter(): {
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
};
export function highlightSpecialChars(config?: {}): any[];
export function history(config?: {}): ({
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
} | {
    id: any;
    createF: any;
    updateF: any;
    compareF: any;
    spec: any;
    create(state: any): any;
    /**
    @internal
    */
    slot(addresses: any): {
        create: (state: any) => number;
        update: (state: any, tr: any) => 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
    /**
    Returns an extension that enables this field and overrides the
    way it is initialized. Can be useful when you need to provide a
    non-default starting value for the field.
    */
    init(create: any): ({
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    } | /*elided*/ any)[];
    /**
    State field instances can be used as
    [`Extension`](https://codemirror.net/6/docs/ref/#state.Extension) values to enable the field in a
    given state.
    */
    get extension(): /*elided*/ any;
} | {
    id: any;
    create: any;
    domEventHandlers: any;
    domEventObservers: any;
    baseExtensions: any;
    extension: any;
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: any): any;
})[];
export var historyKeymap: ({
    key: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    preventDefault: boolean;
    mac?: undefined;
    linux?: undefined;
} | {
    key: string;
    mac: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    preventDefault: boolean;
    linux?: undefined;
} | {
    linux: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    preventDefault: boolean;
    key?: undefined;
    mac?: undefined;
})[];
export function html(config?: {}): {
    language: any;
    support: any[];
    extension: any[];
};
export function javascript(config?: {}): {
    language: any;
    support: any[];
    extension: any[];
};
export var keymap: {
    combine: any;
    compareInput: any;
    compare: any;
    isStatic: any;
    id: number;
    default: any;
    extensions: any;
    /**
    Returns a facet reader for this facet, which can be used to
    [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
    */
    get reader(): /*elided*/ any;
    /**
    Returns an extension that adds the given value to this facet.
    */
    of(value: any): {
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    };
    /**
    Create an extension that computes a value for the facet from a
    state. You must take care to declare the parts of the state that
    this value depends on, since your function is only called again
    for a new state when one of those parts changed.
    
    In cases where your value depends only on a single field, you'll
    want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
    */
    compute(deps: any, get: any): {
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    };
    /**
    Create an extension that computes zero or more values for this
    facet from a state.
    */
    computeN(deps: any, get: any): {
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    };
    from(field: any, get: any): {
        dependencies: any;
        facet: any;
        type: any;
        value: any;
        id: number;
        dynamicSlot(addresses: any): {
            create(state: any): number;
            update(state: any, tr: any): 1 | 0;
            reconfigure: (state: any, oldState: any) => 1 | 0;
        };
    };
};
export function lineNumbers(config?: {}): ({
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
} | {
    id: any;
    create: any;
    domEventHandlers: any;
    domEventObservers: any;
    baseExtensions: any;
    extension: any;
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: any): any;
}[])[];
export function markdown(config?: {}): {
    language: any;
    support: any[];
    extension: any[];
};
export function rectangularSelection(options?: any): {
    dependencies: any;
    facet: any;
    type: any;
    value: any;
    id: number;
    dynamicSlot(addresses: any): {
        create(state: any): number;
        update(state: any, tr: any): 1 | 0;
        reconfigure: (state: any, oldState: any) => 1 | 0;
    };
};
export function redo({ state, dispatch }: {
    state: any;
    dispatch: any;
}): boolean;
export var searchKeymap: ({
    key: string;
    run: (view: any) => boolean;
    scope: string;
    shift?: undefined;
    preventDefault?: undefined;
} | {
    key: string;
    run: (view: any) => any;
    shift: (view: any) => any;
    scope: string;
    preventDefault: boolean;
} | {
    key: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    scope?: undefined;
    shift?: undefined;
    preventDefault?: undefined;
} | {
    key: string;
    run: ({ state, dispatch }: {
        state: any;
        dispatch: any;
    }) => boolean;
    preventDefault: boolean;
    scope?: undefined;
    shift?: undefined;
})[];
export function syntaxHighlighting(highlighter: any, options?: any): {
    inner: any;
    prec: any;
}[];
export namespace tags {
    export { comment };
    export let lineComment: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let blockComment: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let docComment: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { name };
    export let variableName: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { typeName };
    export let tagName: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { propertyName };
    export let attributeName: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let className: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let labelName: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let namespace: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let macroName: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { literal };
    export { string };
    export let docString: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let character: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let attributeValue: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { number };
    export let integer: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let float: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let bool: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let regexp: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let escape: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let color: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let url: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { keyword };
    export let self: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    let _null: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { _null as null };
    export let atom: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let unit: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let modifier: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let operatorKeyword: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let controlKeyword: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let definitionKeyword: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let moduleKeyword: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { operator };
    export let derefOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let arithmeticOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let logicOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let bitwiseOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let compareOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let updateOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let definitionOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let typeOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let controlOperator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { punctuation };
    export let separator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { bracket };
    export let angleBracket: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let squareBracket: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let paren: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let brace: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { content };
    export { heading };
    export let heading1: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let heading2: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let heading3: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let heading4: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let heading5: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let heading6: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let contentSeparator: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let list: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let quote: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let emphasis: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let strong: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let link: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let monospace: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let strikethrough: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let inserted: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let deleted: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let changed: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let invalid: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export { meta };
    export let documentMeta: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let annotation: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export let processingInstruction: {
        name: any;
        set: any;
        base: any;
        modified: any;
        id: number;
        toString(): any;
    };
    export function definition(tag: any): any;
    export function constant(tag: any): any;
    export function _function(tag: any): any;
    export { _function as function };
    export function standard(tag: any): any;
    export function local(tag: any): any;
    export function special(tag: any): any;
}
export function undo({ state, dispatch }: {
    state: any;
    dispatch: any;
}): boolean;

/** CM6 WidgetType base class — extend to build inline widgets. */
export declare class WidgetType {
    /** Called once to create the widget's DOM node. */
    toDOM(view: any): HTMLElement;
    /** Return true if this widget can be reused for `widget`. */
    eq(widget: WidgetType): boolean;
    /** Return true to propagate events through to CodeMirror. */
    ignoreEvent(event: Event): boolean;
    /** Estimated height for the widget (use -1 to let CM measure it). */
    get estimatedHeight(): number;
    /** Width of the widget when used as a block widget (use -1 for auto). */
    get lineBreaks(): number;
    updateDOM(dom: HTMLElement, view: any): boolean;
}

/** CM6 Decoration factory — creates mark, line, replace and widget decorations. */
export declare const Decoration: {
    /** Create a mark decoration (spans a range of content). */
    mark(spec: { class?: string; attributes?: Record<string, string>; tagName?: string; inclusive?: boolean; inclusiveStart?: boolean; inclusiveEnd?: boolean }): any;
    /** Create a line decoration (applies a class / attributes to a whole line). */
    line(spec: { class?: string; attributes?: Record<string, string> }): any;
    /** Create a widget decoration (inserts a widget at a position). */
    widget(spec: { widget: WidgetType; side?: number; block?: boolean; inlineOrder?: boolean }): any;
    /** Create a replace decoration (replaces a range with optional widget). */
    replace(spec: { widget?: WidgetType; inclusive?: boolean; inclusiveStart?: boolean; inclusiveEnd?: boolean; block?: boolean }): any;
    /** Empty decoration set. */
    none: any;
    /** Build a DecorationSet from an array of Ranges. */
    set(of: any[], sort?: boolean): any;
};

/** CM6 RangeSetBuilder — accumulates ranges in ascending order then calls finish(). */
export declare class RangeSetBuilder<T = any> {
    constructor();
    /** Add a range. Ranges MUST be added in ascending `from` order. */
    add(from: number, to: number, value: T): void;
    /** Finalize and return the RangeSet. */
    finish(): any;
}

/** CM6 ViewPlugin — creates a plugin that participates in the view update cycle. */
export declare const ViewPlugin: {
    /** Create a view plugin from a class constructor. */
    fromClass<T>(
        cls: new (view: any) => T,
        spec?: {
            decorations?: (plugin: T) => any;
            eventHandlers?: Record<string, (this: T, event: Event, view: any) => boolean | void>;
            eventObservers?: Record<string, (this: T, event: Event, view: any) => void>;
            provide?: (plugin: any) => any;
        },
    ): any;
    /** Low-level define (use fromClass instead for class-based plugins). */
    define<T>(
        create: (view: any) => T,
        spec?: { decorations?: (value: T) => any },
    ): any;
};
declare var comment: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var name: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var typeName: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var propertyName: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var literal: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var string: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var number: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var keyword: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var operator: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var punctuation: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var bracket: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var content: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var heading: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
declare var meta: {
    name: any;
    set: any;
    base: any;
    modified: any;
    id: number;
    toString(): any;
};
export {};
