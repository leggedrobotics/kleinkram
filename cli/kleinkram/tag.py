from __future__ import annotations

from datetime import datetime
from typing import Dict
from typing import Union

import typer

from kleinkram.models import DataType
from kleinkram.models import TagType


def _prompt_tag(tag: TagType) -> Union[str, bool, float, datetime]:

    def _prompt_str(val: str) -> str:
        return f"Provide {val} for required tag: {tag.name}"

    while True:
        if tag.data_type in [DataType.LOCATION, DataType.STRING, DataType.LINK]:
            tag_value = typer.prompt(_prompt_str("value"))
            if tag_value != "":
                break
        elif tag.data_type == DataType.BOOLEAN:
            tag_value = typer.confirm(_prompt_str("(y/N)"))
            break
        elif tag.data_type == DataType.NUMBER:
            # TODO: shouldnt this be an int?
            tag_value = typer.prompt(_prompt_str("number"))
            try:
                tag_value = float(tag_value)
                break
            except ValueError:
                typer.echo("Invalid number format")
        elif tag.data_type == DataType.DATE:
            tag_value = typer.prompt(_prompt_str("date"))
            try:
                tag_value = datetime.strptime(tag_value, "%Y-%m-%d %H:%M:%S")
                break
            except ValueError:
                typer.echo("Invalid date format. Please use 'YYYY-MM-DD HH:MM:SS'")
    return tag_value


def prompt_required_tags(
    set_tags: Dict[str, Union[str, bool, float, datetime]],
    required_tags: Dict[str, TagType],
):
    for name, tp in required_tags.items():
        if name not in set_tags:
            set_tags[name] = _prompt_tag(tp)
