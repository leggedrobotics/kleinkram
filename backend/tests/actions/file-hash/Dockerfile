FROM python:latest

# COPY CLI code to the container
COPY ./../../../../cli /cli

# install requirements
RUN pip install /cli

# copy entrypoint and make it executable
COPY ./backend/tests/actions/file-hash/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# set entrypoint
ENTRYPOINT ["/entrypoint.sh"]