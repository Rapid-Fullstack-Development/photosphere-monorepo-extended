
//
// Creates a row-based layout for the photo gallery.
//
export function createLayout(items, galleryWidth, targetRowHeight) {

    if (!items || !items.length) {
        return [];
    }

    const rows = [];

    let curRow: any = {
        items: [],
        height: targetRowHeight,
        width: 0,
    };

    rows.push(curRow);

    //
    // Initially assign each gallery item to a series of rows.
    //
    for (const item of items) {

        const aspectRatio = item.width / item.height;
        const computedWidth = targetRowHeight * aspectRatio;

        if (curRow.items.length > 0) {
            if (curRow.width + computedWidth > galleryWidth) {
                //
                // Break row on width.
                //
                curRow = {
                    items: [],
                    height: targetRowHeight,
                    width: 0,
                    group: item.group,
                };
                rows.push(curRow);
            }

            if (curRow.group !== item.group) {
                //
                // Break row on group.
                //
                curRow = { //TODO: This should be optional.
                    items: [],
                    height: targetRowHeight,
                    width: 0,
                    group: item.group,
                };
                rows.push(curRow);                
            }
        }
        else {
            curRow.group = item.group;
        }

        //
        // Clone the item so we can modify it without modifying the original.
        //
        const clone = Object.assign({}, item, {
            width: computedWidth,
            height: targetRowHeight,
            aspectRatio: aspectRatio,
        });

        //
        // Add the item to the row.
        //
        curRow.items.push(clone);
        curRow.width += computedWidth;
    }

    //
    // For all rows, except the last row, stretch the items towards the right hand boundary.
    //
    for (let rowIndex = 0; rowIndex < rows.length-1; rowIndex++) {
        const row = rows[rowIndex];
        const nextRow = rows[rowIndex+1];
        if (row.group !== nextRow.group) {
            //TODO: This should be optional.
            continue; // Don't expand the last row in each group.
        }

        let rowWidth = row.width;
        
        const gap = galleryWidth - rowWidth;
        const deltaWidth = gap / row.items.length;

        let maxThumbHeight = 0;

        //
        // Expand each item to fill the gap.
        //
        for (const item of row.items) {
            const aspectRatio = item.aspectRatio;

            item.width += deltaWidth;
            item.height = item.width * (1.0 / aspectRatio);
            maxThumbHeight = Math.max(maxThumbHeight, item.height);
        }

        row.height = maxThumbHeight;
    }

    return rows;
}
